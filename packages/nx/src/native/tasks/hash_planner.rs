use crate::native::tasks::{
    dep_outputs::get_dep_output,
    types::{HashInstruction, TaskGraph},
};
use crate::native::types::{Input, NxJson};
use crate::native::{
    project_graph::types::ProjectGraph,
    tasks::{inputs::SplitInputs, types::Task},
};
use napi::{Env, JsExternal};
use rayon::prelude::*;
use std::collections::HashMap;

use crate::native::tasks::inputs::{
    expand_single_project_inputs, get_inputs, get_inputs_for_dependency, get_named_inputs,
};
use crate::native::tasks::utils;
use crate::native::utils::find_matching_projects;

#[napi]
pub struct HashPlanner {
    nx_json: NxJson,
    project_graph: ProjectGraph,
    workspace_root: String,
}

#[napi]
impl HashPlanner {
    #[napi(constructor)]
    pub fn new(workspace_root: String, nx_json: NxJson, project_graph: ProjectGraph) -> Self {
        Self {
            nx_json,
            project_graph,
            workspace_root,
        }
    }

    pub fn get_plans_internal(
        &self,
        task_ids: Vec<&str>,
        task_graph: TaskGraph,
    ) -> anyhow::Result<HashMap<String, Vec<HashInstruction>>> {
        let external_deps_mapped = self.setup_external_deps();
        task_ids
            .par_iter()
            .map(|id| {
                let task = &task_graph
                    .tasks
                    .get(*id)
                    .ok_or_else(|| anyhow::anyhow!("Task with id '{id}' not found"))?;
                let inputs = get_inputs(task, &self.project_graph, &self.nx_json)?;

                let target = self.target_input(
                    &task.target.project,
                    &task.target.target,
                    &inputs.self_inputs,
                    &external_deps_mapped,
                )?;

                let self_inputs = self.self_and_deps_inputs(
                    &task.target.project,
                    task,
                    &inputs,
                    &task_graph,
                    &external_deps_mapped,
                    &mut Box::new(hashbrown::HashSet::from([task.target.project.to_string()])),
                )?;

                let mut inputs: Vec<HashInstruction> = target
                    .unwrap_or(vec![])
                    .into_iter()
                    .chain(vec![
                        HashInstruction::WorkspaceFileSet("{workspaceRoot}/nx.json".to_string()),
                        HashInstruction::WorkspaceFileSet("{workspaceRoot}/.gitignore".to_string()),
                        HashInstruction::WorkspaceFileSet("{workspaceRoot}/.nxignore".to_string()),
                    ])
                    .chain(self_inputs.into_iter())
                    .collect();

                inputs.par_sort();
                inputs.dedup();

                Ok((id.to_string(), inputs))
            })
            .collect()
    }

    #[napi(ts_return_type = "Record<string, string[]>")]
    pub fn get_plans(
        &self,
        task_ids: Vec<&str>,
        task_graph: TaskGraph,
    ) -> anyhow::Result<HashMap<String, Vec<HashInstruction>>> {
        self.get_plans_internal(task_ids, task_graph)
    }

    #[napi]
    pub fn get_plans_reference(
        &self,
        env: Env,
        task_ids: Vec<&str>,
        task_graph: TaskGraph,
    ) -> anyhow::Result<JsExternal> {
        let plans = self.get_plans_internal(task_ids, task_graph)?;
        env.create_external(plans, None)
            .map_err(anyhow::Error::from)
    }

    fn target_input<'a>(
        &'a self,
        project_name: &str,
        target_name: &str,
        self_inputs: &[Input],
        external_deps_map: &hashbrown::HashMap<&str, Vec<&'a str>>,
    ) -> anyhow::Result<Option<Vec<HashInstruction>>> {
        let project = &self.project_graph.nodes[project_name];
        let Some(target) = project.targets.get(target_name) else {
            return Ok(None)
        };

        let external_nodes_keys: Vec<&str> = self
            .project_graph
            .external_nodes
            .keys()
            .map(|s| s.as_str())
            .collect();

        // we can only vouch for @nx packages's executor dependencies
        // if it's "run commands" or third-party we skip traversing since we have no info what this command depends on
        if target
            .executor
            .as_ref()
            .is_some_and(|e| e.starts_with("@nrwl/") || e.starts_with("@nx/"))
        {
            let executor_package = target
                .executor
                .as_ref()
                .unwrap()
                .split(':')
                .next()
                .expect("Executors should always have a ':'");
            let existing_package =
                find_external_dependency_node_name(executor_package, &external_nodes_keys)
                    .unwrap_or_else(|| executor_package);
            Ok(Some(vec![HashInstruction::External(
                existing_package.to_string(),
            )]))
        } else {
            let mut external_deps: Vec<&str> = vec![];
            for input in self_inputs {
                match input {
                    Input::ExternalDependency(deps) => {
                        for dep in deps.iter() {
                            let external_node_name: Option<&str> =
                                find_external_dependency_node_name(dep, &external_nodes_keys);
                            let Some(external_node_name) = external_node_name else {
                                anyhow::bail!("The externalDependency '{dep}' for '{project_name}:{target_name}' could not be found")
                            };

                            external_deps.push(external_node_name);
                            external_deps.extend(&external_deps_map[external_node_name]);
                        }
                    }
                    _ => continue,
                }
            }
            if !external_deps.is_empty() {
                Ok(Some(
                    external_deps
                        .iter()
                        .map(|s| HashInstruction::External(s.to_string()))
                        .collect(),
                ))
            } else {
                Ok(Some(vec![HashInstruction::AllExternalDependencies]))
            }
        }
    }

    fn self_and_deps_inputs(
        &self,
        project_name: &str,
        task: &Task,
        inputs: &SplitInputs,
        task_graph: &TaskGraph,
        external_deps_mapped: &hashbrown::HashMap<&str, Vec<&str>>,
        visited: &mut Box<hashbrown::HashSet<String>>,
    ) -> anyhow::Result<Vec<HashInstruction>> {
        let project_deps = &self.project_graph.dependencies[&task.target.project]
            .iter()
            .map(|d| d.as_str())
            .collect::<Vec<_>>();
        let self_inputs = self.gather_self_inputs(project_name, &inputs.self_inputs);
        let deps_inputs = self.gather_dependency_inputs(
            task,
            &inputs.deps_inputs,
            task_graph,
            project_deps,
            external_deps_mapped,
            visited,
        )?;

        let deps_outputs =
            self.gather_dependency_outputs(task, task_graph, &inputs.deps_outputs)?;
        let projects = self.gather_project_inputs(&inputs.project_inputs)?;

        Ok(self_inputs
            .into_iter()
            .chain(deps_inputs.into_iter())
            .chain(deps_outputs.into_iter())
            .chain(projects.into_iter())
            .collect())
    }

    fn setup_external_deps(&self) -> hashbrown::HashMap<&str, Vec<&str>> {
        self.project_graph
            .external_nodes
            .keys()
            .collect::<Vec<_>>()
            .par_iter()
            .map(|external_node| {
                (
                    external_node.as_str(),
                    utils::find_all_project_node_dependencies(
                        external_node,
                        &self.project_graph,
                        false,
                    ),
                )
            })
            .collect()
    }

    // todo(jcammisuli): parallelize this more. This function takes the longest time to run
    fn gather_dependency_inputs<'a>(
        &'a self,
        task: &Task,
        inputs: &[Input],
        task_graph: &TaskGraph,
        project_deps: &[&'a str],
        external_deps_mapped: &hashbrown::HashMap<&str, Vec<&'a str>>,
        visited: &mut Box<hashbrown::HashSet<String>>,
    ) -> anyhow::Result<Vec<HashInstruction>> {
        let mut deps_inputs: Vec<HashInstruction> = vec![];

        for input in inputs {
            for dep in project_deps {
                if visited.contains(*dep) {
                    continue;
                }
                visited.insert(dep.to_string());

                if self.project_graph.nodes.contains_key(*dep) {
                    let Some(dep_inputs) = get_inputs_for_dependency(
                            &self.project_graph.nodes[*dep],
                            &self.nx_json,
                            input,
                        )? else {
                            continue;
                        };
                    deps_inputs.extend(self.self_and_deps_inputs(
                        dep,
                        task,
                        &dep_inputs,
                        task_graph,
                        external_deps_mapped,
                        visited,
                    )?);
                } else {
                    // todo(jcammisuli): add a check to skip this when the new task hasher is ready, and when `AllExternalDependencies` is used
                    if let Some(external_deps) = external_deps_mapped.get(dep) {
                        deps_inputs.push(HashInstruction::External(dep.to_string()));
                        deps_inputs.extend(
                            external_deps
                                .iter()
                                .map(|s| HashInstruction::External(s.to_string())),
                        );
                    }
                }
            }
        }

        Ok(deps_inputs)
    }

    fn gather_self_inputs(
        &self,
        project_name: &str,
        self_inputs: &[Input],
    ) -> Vec<HashInstruction> {
        let (project_file_sets, workspace_file_sets): (Vec<&str>, Vec<&str>) = self_inputs
            .iter()
            .filter_map(|input| match input {
                Input::FileSet(file_set) => Some(file_set),
                _ => None,
            })
            .partition(|file_set| {
                file_set.starts_with("{projectRoot}/") || file_set.starts_with("!{projectRoot}/")
            });

        let project_file_set_inputs = project_file_set_inputs(project_name, project_file_sets);
        let workspace_file_set_inputs = workspace_file_set_inputs(workspace_file_sets);
        let runtime_and_env_inputs = self_inputs.iter().filter_map(|i| match i {
            Input::Runtime(runtime) => Some(HashInstruction::Runtime(runtime.to_string())),
            Input::Environment(env) => Some(HashInstruction::Environment(env.to_string())),
            _ => None,
        });

        project_file_set_inputs
            .into_iter()
            .chain(workspace_file_set_inputs)
            .chain(runtime_and_env_inputs)
            .collect()
    }

    fn gather_dependency_outputs(
        &self,
        task: &Task,
        task_graph: &TaskGraph,
        deps_outputs: &[Input],
    ) -> anyhow::Result<Vec<HashInstruction>> {
        if deps_outputs.is_empty() {
            return Ok(vec![]);
        }

        let mut result: Vec<HashInstruction> = vec![];

        for dep in deps_outputs {
            let Input::DepsOutputs { dependent_tasks_output_files, transitive } = dep else {
                continue;
            };
            result.extend(get_dep_output(
                &self.workspace_root,
                task,
                task_graph,
                &self.project_graph,
                dependent_tasks_output_files,
                *transitive,
            )?);
        }

        Ok(result)
    }

    fn gather_project_inputs(
        &self,
        project_inputs: &[Input],
    ) -> anyhow::Result<Vec<HashInstruction>> {
        let mut result: Vec<HashInstruction> = vec![];
        for project in project_inputs {
            let Input::Projects {input, projects} = project else {
                continue;
            };
            let projects = find_matching_projects(projects, &self.project_graph)?;
            for project in projects {
                let named_inputs =
                    get_named_inputs(&self.nx_json, &self.project_graph.nodes[project]);
                let expanded_input = expand_single_project_inputs(
                    &vec![Input::Inputs {
                        input,
                        dependencies: false,
                    }],
                    &named_inputs,
                )?;
                result.extend(self.gather_self_inputs(project, &expanded_input))
            }
        }
        Ok(result)
    }
}

fn find_external_dependency_node_name<'a>(
    package_name: &str,
    external_nodes: &[&'a str],
) -> Option<&'a str> {
    external_nodes
        .iter()
        .find(|n| **n == package_name || n.ends_with(package_name))
        .copied()
}

fn project_file_set_inputs(project_name: &str, file_sets: Vec<&str>) -> Vec<HashInstruction> {
    vec![
        HashInstruction::ProjectFileSet(project_name.to_string(), file_sets.join(",")),
        HashInstruction::ProjectConfiguration(project_name.to_string()),
        HashInstruction::TsConfiguration(project_name.to_string()),
    ]
}

fn workspace_file_set_inputs(file_sets: Vec<&str>) -> Vec<HashInstruction> {
    file_sets
        .into_iter()
        .map(|s| HashInstruction::WorkspaceFileSet(s.to_string()))
        .collect()
}
