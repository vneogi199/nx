import { VideoLoop } from './video-loop.component';
import { Schema } from '@markdoc/markdoc';
import { TerminalShellWrapper } from '../nodes/fences/terminal-shell.component';

export const terminalVideo: Schema = {
  render: 'TerminalVideo',
  attributes: {
    src: {
      type: 'String',
      required: true,
    },
    alt: {
      type: 'String',
      required: true,
    },
  },
};

export function TerminalVideo({
  src,
  alt,
}: {
  src: string;
  alt: string;
}): JSX.Element {
  return (
    <TerminalShellWrapper isMessageBelow={false}>
      <div className="overflow-x-auto">
        <VideoLoop src={src} alt={alt}></VideoLoop>
      </div>
    </TerminalShellWrapper>
  );
}
