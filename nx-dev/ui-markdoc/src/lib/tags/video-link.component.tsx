import { Schema } from '@markdoc/markdoc';

export const videoLink: Schema = {
  render: 'VideoLink',
  attributes: {
    link: {
      type: 'String',
      required: true,
    },
    text: {
      type: 'String',
      required: false,
    },
  },
};

const youtubeIcon = (
  <svg
    fill="currentColor"
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className="w-6 h-6"
  >
    <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14c-1.88-.5-9.38-.5-9.38-.5s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.87.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.54 15.57V8.43L15.82 12l-6.28 3.57z" />
  </svg>
);

export function VideoLink({ text, link }: { text: string; link: string }) {
  return (
    <div className="flex no-prose">
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center no-underline space-x-2 border-transparent"
      >
        <div className="flex items-center justify-between pl-2 pr-2 space-x-2 border rounded-md border-slate-200 py-1 pl-3 transition hover:border-slate-500 dark:border-slate-700/40 dark:hover:border-slate-700">
          {youtubeIcon}
          <span className="font-semibold text-md hover:text-slate-900 dark:hover:text-sky-400">
            {text || 'Jump to section in video'}
          </span>
        </div>
      </a>
    </div>
  );
}
