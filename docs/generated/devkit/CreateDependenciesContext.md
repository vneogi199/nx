# Interface: CreateDependenciesContext

Context for [CreateDependencies](../../devkit/documents/CreateDependencies)

## Table of contents

### Properties

- [externalNodes](../../devkit/documents/CreateDependenciesContext#externalnodes): Record&lt;string, ProjectGraphExternalNode&gt;
- [fileMap](../../devkit/documents/CreateDependenciesContext#filemap): FileMap
- [filesToProcess](../../devkit/documents/CreateDependenciesContext#filestoprocess): FileMap
- [nxJsonConfiguration](../../devkit/documents/CreateDependenciesContext#nxjsonconfiguration): NxJsonConfiguration&lt;string[] | &quot;\*&quot;&gt;
- [projects](../../devkit/documents/CreateDependenciesContext#projects): Record&lt;string, ProjectConfiguration&gt;
- [workspaceRoot](../../devkit/documents/CreateDependenciesContext#workspaceroot): string

## Properties

### externalNodes

• `Readonly` **externalNodes**: `Record`<`string`, [`ProjectGraphExternalNode`](../../devkit/documents/ProjectGraphExternalNode)\>

The external nodes that have been added to the graph.

---

### fileMap

• `Readonly` **fileMap**: [`FileMap`](../../devkit/documents/FileMap)

All files in the workspace

---

### filesToProcess

• `Readonly` **filesToProcess**: [`FileMap`](../../devkit/documents/FileMap)

Files changes since last invocation

---

### nxJsonConfiguration

• `Readonly` **nxJsonConfiguration**: [`NxJsonConfiguration`](../../devkit/documents/NxJsonConfiguration)<`string`[] \| `"*"`\>

The `nx.json` configuration from the workspace

---

### projects

• `Readonly` **projects**: `Record`<`string`, [`ProjectConfiguration`](../../devkit/documents/ProjectConfiguration)\>

The configuration of each project in the workspace.

---

### workspaceRoot

• `Readonly` **workspaceRoot**: `string`
