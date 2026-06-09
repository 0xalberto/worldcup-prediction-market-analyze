import { Flag } from '@/components/Flag';
import { cn } from '@/lib/utils';
import type { SerializedResult } from '@/lib/sim/worker';
import { teamFlagCode } from '@/lib/demo/flags';

interface Props {
  result: SerializedResult;
  teamIds: string[];
  size?: number;
  layout?: 'stack' | 'versus';
  className?: string;
}

export function DemoTeamFlags({
  result,
  teamIds,
  size = 28,
  layout = 'stack',
  className,
}: Props) {
  const ids = [...new Set(teamIds.filter(Boolean))];
  if (ids.length === 0) return null;

  if (layout === 'versus' && ids.length >= 2) {
    const [home, away] = ids;
    const homeFlag = teamFlagCode(result, home);
    const awayFlag = teamFlagCode(result, away);
    if (!homeFlag && !awayFlag) return null;

    return (
      <div className={cn('flex shrink-0 items-center gap-1.5', className)}>
        {homeFlag ? <Flag code={homeFlag} size={size} className="ring-2 ring-bg-1" /> : null}
        <span className="font-mono text-[9px] uppercase tracking-wider text-fg-3">vs</span>
        {awayFlag ? <Flag code={awayFlag} size={size} className="ring-2 ring-bg-1" /> : null}
      </div>
    );
  }

  return (
    <div className={cn('flex shrink-0 items-center -space-x-1.5', className)}>
      {ids.map((id) => {
        const code = teamFlagCode(result, id);
        if (!code) return null;
        return <Flag key={id} code={code} size={size} className="ring-2 ring-bg-1" />;
      })}
    </div>
  );
}
