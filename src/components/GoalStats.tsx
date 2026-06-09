'use client';

import { useMemo, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import * as d3 from 'd3';
import { Flag } from './Flag';
import type { SerializedResult } from '@/lib/sim/worker';

interface Props { result: SerializedResult; }

export function GoalStats({ result }: Props) {
  const t = useTranslations('goals');
  const locale = useLocale();
  const svgRef = useRef<SVGSVGElement>(null);

  const topScorers = useMemo(() => {
    return result.teams
      .map((team, i) => ({
        team,
        idx: i,
        avgGF: result.totalGoalsFor[i] / result.numSimulations,
      }))
      .sort((a, b) => b.avgGF - a.avgGF)
      .slice(0, 10);
  }, [result]);

  const teamById = useMemo(() => new Map(result.teams.map((t) => [t.id, t])), [result]);

  const topPlayers = useMemo(() => {
    return result.scorers
      .filter(([k]) => !k.endsWith('|Otros'))
      .map(([key, total]) => {
        const [teamId, name] = key.split('|');
        return { teamId, name, goals: total / result.numSimulations, team: teamById.get(teamId) };
      })
      .filter((x) => x.team)
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 10);
  }, [result, teamById]);

  const totalGoalsStats = useMemo(() => {
    const h = result.tournamentGoalsHistogram;
    let n = 0, sum = 0;
    for (let g = 0; g < h.length; g++) { n += h[g]; sum += g * h[g]; }
    return {
      mean: sum / Math.max(1, n),
      histogram: h,
    };
  }, [result]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const width = svg.clientWidth || 800;
    const height = 200;
    const margin = { top: 16, right: 24, bottom: 28, left: 24 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const data: { g: number; count: number }[] = [];
    for (let g = 100; g < totalGoalsStats.histogram.length; g++) {
      if (totalGoalsStats.histogram[g] > 0) {
        data.push({ g, count: totalGoalsStats.histogram[g] });
      }
    }
    if (data.length === 0) return;

    const xMin = d3.min(data, (d) => d.g)!;
    const xMax = d3.max(data, (d) => d.g)!;
    const x = d3.scaleLinear().domain([xMin - 5, xMax + 5]).range([0, innerW]);
    const y = d3.scaleLinear()
      .domain([0, d3.max(data, (d) => d.count) ?? 1])
      .range([innerH, 0]);

    d3.select(svg).selectAll('*').remove();
    const g = d3.select(svg)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const area = d3.area<{ g: number; count: number }>()
      .x((d) => x(d.g))
      .y0(innerH)
      .y1((d) => y(d.count))
      .curve(d3.curveBasis);

    const gradId = 'goalGrad';
    const defs = d3.select(svg).append('defs');
    const grad = defs.append('linearGradient').attr('id', gradId).attr('x1', '0').attr('x2', '0').attr('y1', '0').attr('y2', '1');
    grad.append('stop').attr('offset', '0%').attr('stop-color', 'oklch(0.76 0.13 180)').attr('stop-opacity', 0.85);
    grad.append('stop').attr('offset', '100%').attr('stop-color', 'oklch(0.76 0.13 180)').attr('stop-opacity', 0.05);

    g.append('path')
      .datum(data)
      .attr('fill', `url(#${gradId})`)
      .attr('stroke', 'oklch(0.76 0.13 180)')
      .attr('stroke-width', 1.5)
      .attr('d', area);

    // mean line
    g.append('line')
      .attr('x1', x(totalGoalsStats.mean))
      .attr('x2', x(totalGoalsStats.mean))
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', 'oklch(0.72 0.17 155)')
      .attr('stroke-dasharray', '4 4')
      .attr('stroke-width', 1);
    g.append('text')
      .attr('x', x(totalGoalsStats.mean) + 6)
      .attr('y', 14)
      .attr('fill', 'oklch(0.72 0.17 155)')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', 10)
      .text(`μ = ${totalGoalsStats.mean.toFixed(1)}`);

    // x axis
    const xAxis = g.append('g')
      .attr('transform', `translate(0, ${innerH})`)
      .call(d3.axisBottom(x).ticks(8).tickSize(0));
    xAxis.selectAll('text').attr('fill', 'oklch(0.55 0.015 260)').attr('font-family', 'JetBrains Mono, monospace').attr('font-size', 10);
    xAxis.selectAll('line').remove();
    xAxis.select('.domain').remove();
  }, [totalGoalsStats]);

  const maxGF = topScorers[0]?.avgGF ?? 1;

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 sm:py-20">
      <header className="mb-8">
        <h2 className="font-display text-3xl font-bold tracking-tight text-fg-0 sm:text-4xl lg:text-5xl">{t('title')}</h2>
        <p className="mt-2 text-sm text-fg-2">{t('subtitle')}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-border glass p-6">
          <h3 className="text-xs uppercase tracking-[0.18em] text-fg-3 font-mono mb-4">
            Goals per tournament - density
          </h3>
          <svg ref={svgRef} className="h-[200px] w-full" />
        </div>

        <div className="rounded-2xl border border-border glass p-6">
          <h3 className="text-xs uppercase tracking-[0.18em] text-fg-3 font-mono mb-4">
            {t('top_scoring')}
          </h3>
          <ol className="space-y-2.5">
            {topScorers.map((s, i) => (
              <li key={s.team.id} className="flex items-center gap-3">
                <span className="w-5 text-right font-mono text-[10px] text-fg-3 tabular">{i + 1}</span>
                <Flag code={s.team.flag} size={20} />
                <span className="flex-1 truncate text-sm text-fg-1">
                  {locale === 'es' ? s.team.name_es : s.team.name_en}
                </span>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-bg-2/60">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(s.avgGF / maxGF) * 100}%`,
                      background: 'linear-gradient(90deg, oklch(0.60 0.10 180), oklch(0.76 0.13 180))',
                    }}
                  />
                </div>
                <span className="w-10 text-right font-mono text-xs tabular text-fg-0">
                  {s.avgGF.toFixed(1)}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[10px] text-fg-3 font-mono">{t('avg_per_tournament')}</p>
        </div>

        <div className="rounded-2xl border border-border glass p-6 lg:col-span-2">
          <h3 className="text-xs uppercase tracking-[0.18em] text-fg-3 font-mono mb-4">
            Top 10 goleadores individuales <span className="text-fg-3 normal-case">· aproximación goal-share</span>
          </h3>
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {topPlayers.map((p, i) => (
              <li key={`${p.teamId}|${p.name}`} className="flex items-center gap-3 rounded-lg border border-border bg-bg-2/30 px-3 py-2">
                <span className="w-5 text-right font-mono text-[10px] text-fg-3 tabular">{i + 1}</span>
                {p.team && <Flag code={p.team.flag} size={20} />}
                <span className="flex-1 truncate text-sm text-fg-1">{p.name}</span>
                <span className="font-mono text-xs tabular text-fg-0">{p.goals.toFixed(2)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[10px] text-fg-3">
            Distribución multinomial sobre los goles de cada equipo. No modela lesiones, forma o suplencias -
            ver <a className="underline decoration-gold/40 underline-offset-2" href="/methodology">metodología</a>.
          </p>
        </div>
      </div>
    </section>
  );
}
