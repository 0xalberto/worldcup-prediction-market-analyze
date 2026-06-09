import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { ArrowLeft } from 'lucide-react';
import { runBacktest, runBonusSweep, runRecentFormSweep, runPenaltyEvaluation, type CalibrationBucket, type PenaltyEvalRow, type RecentFormSweepCell, type ScoredMatch, type SweepPoint } from '@/lib/sim/backtest';
import { cn } from '@/lib/utils';

export const dynamic = 'force-static';

export default async function BacktestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Baseline (legacy, no recent-form blend) and current model (with blend) - so
  // we can show the user what the merged Tier 1 #2 actually changes.
  const baseline = runBacktest({ recentAlpha: 0 });
  const r = runBacktest({ recentAlpha: 0.2, recentLookbackYears: 1 });
  const sweep = runBonusSweep();
  const recentSweep = runRecentFormSweep();
  const penEval = runPenaltyEvaluation();

  return (
    <article className="relative mx-auto max-w-[1100px] px-6 pt-32 pb-14">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-fg-3 transition-colors hover:text-fg-1"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al simulador
      </Link>

      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 font-mono text-[10px] tracking-[0.18em] text-gold/90">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          VALIDACIÓN HISTÓRICA
        </div>
        <h1 className="mt-5 font-display text-5xl font-bold tracking-tight text-fg-0 sm:text-6xl">
          Backtest
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-fg-1">
          Aplicamos el modelo actual a los Mundiales{' '}
          <span className="text-fg-0 font-medium">2014, 2018 y 2022</span> usando el ELO de fin del año
          anterior y los 192 resultados de tiempo regular. Lo que sigue es honesto, no es marketing.
        </p>
      </header>

      <section className="mt-14 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Brier score"
          value={r.overall.brier.toFixed(3)}
          tone={r.overall.brier < 0.55 ? 'good' : r.overall.brier < 0.62 ? 'mid' : 'bad'}
          subtitle="menor = mejor · random 0.667"
        />
        <Stat
          label="Log loss"
          value={r.overall.logLoss.toFixed(3)}
          tone={r.overall.logLoss < 0.95 ? 'good' : r.overall.logLoss < 1.05 ? 'mid' : 'bad'}
          subtitle="menor = mejor · random 1.099"
        />
        <Stat
          label="Accuracy top-1"
          value={(r.overall.accuracy * 100).toFixed(1) + '%'}
          tone={r.overall.accuracy > 0.6 ? 'good' : r.overall.accuracy > 0.5 ? 'mid' : 'bad'}
          subtitle={`${r.overall.count} partidos · random 33%`}
        />
      </section>

      <Section title="Por torneo">
        <div className="overflow-x-auto rounded-2xl border border-border glass">
          <table className="min-w-full">
            <thead className="text-[10px] uppercase tracking-[0.18em] text-fg-3 font-mono">
              <tr>
                <th className="px-4 py-3 text-left">Mundial</th>
                <th className="px-3 py-3 text-right">N</th>
                <th className="px-3 py-3 text-right">Brier</th>
                <th className="px-3 py-3 text-right">Log loss</th>
                <th className="px-3 py-3 text-right">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {r.perTournament.map((t) => (
                <tr key={t.year} className="border-t border-border/40">
                  <td className="px-4 py-2.5 text-sm text-fg-1">
                    <span className="font-medium text-fg-0">{t.year}</span>{' '}
                    <span className="text-fg-3">· {t.host}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-fg-2">{t.aggregate.count}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-fg-0">{t.aggregate.brier.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-fg-0">{t.aggregate.logLoss.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-fg-0">{(t.aggregate.accuracy * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Por etapa">
        <div className="overflow-x-auto rounded-2xl border border-border glass">
          <table className="min-w-full">
            <thead className="text-[10px] uppercase tracking-[0.18em] text-fg-3 font-mono">
              <tr>
                <th className="px-4 py-3 text-left">Etapa</th>
                <th className="px-3 py-3 text-right">N</th>
                <th className="px-3 py-3 text-right">Brier</th>
                <th className="px-3 py-3 text-right">Log loss</th>
                <th className="px-3 py-3 text-right">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {(['group', 'r16', 'qf', 'sf', '3rd', 'final'] as const).map((s) => {
                const a = r.perStage[s];
                if (a.count === 0) return null;
                return (
                  <tr key={s} className="border-t border-border/40">
                    <td className="px-4 py-2.5 text-sm text-fg-1">{STAGE_LABEL[s]}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-fg-2">{a.count}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-fg-0">{a.brier.toFixed(3)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-fg-0">{a.logLoss.toFixed(3)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-fg-0">{(a.accuracy * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-fg-3">
          El modelo es más sólido en fase de grupos (más muestras, ELO gap más decisivo) y se degrada en
          KO tardío donde los rivales tienen ELO parecido y la varianza Poisson domina.
        </p>
      </Section>

      <Section title="Calibración">
        <p className="mb-4 text-sm text-fg-2">
          Cuando el modelo dice <span className="text-fg-1">"X% de probabilidad"</span>, ¿la frecuencia
          observada coincide? La diagonal punteada es la calibración perfecta - cuanto más cerca, mejor.
        </p>
        <CalibrationPlot buckets={r.calibration} />
      </Section>

      <Section title="Sweep · Recent-form blend">
        <p className="mb-4 max-w-3xl text-sm text-fg-2">
          Hipótesis: el ELO se actualiza lento porque su K-factor está calibrado para amistosos +
          qualifiers. Un equipo que cambió de nivel en el último año queda subvaluado. Probamos
          un ajuste{' '}
          <code className="rounded bg-bg-2/60 px-1.5 py-0.5 font-mono text-xs">ELO_eff = ELO + α · (ELO − ELO_X años atrás)</code>{' '}
          con cap ±150, sweepeando <span className="text-fg-1">α ∈ {'{0, 0.1, 0.2, 0.3, 0.5}'}</span> y{' '}
          <span className="text-fg-1">X ∈ {'{1, 2, 3, 4, 5}'} años</span>.
        </p>
        <RecentFormHeatmap cells={recentSweep} />
        <div className="mt-5 max-w-3xl space-y-3 text-sm text-fg-2">
          <p>
            <span className="text-emerald font-medium">Óptimo: α=0.2, lookback=1 año.</span>{' '}
            Brier {recentSweep.reduce((m, c) => (c.overall.brier < m.overall.brier ? c : m), recentSweep[0]).overall.brier.toFixed(4)}{' '}
            vs baseline {baseline.overall.brier.toFixed(4)}. Δ minúsculo en Brier (~−0.0003),
            pero <strong className="text-fg-1">accuracy +1.6 puntos</strong> (3 partidos más correctos de 192).
          </p>
          <p>
            <strong className="text-fg-1">Lookback de 3 años empeora claramente</strong> - a esa distancia el equipo
            cambió de lineup y la "tendencia" mete ruido. Lookbacks 1, 2, 4, 5 funcionan parecido. Que el
            mínimo esté en 1y confirma que el ELO actual ya integra los últimos 12 meses con buen peso.
          </p>
          <p className="text-fg-3">
            <strong>Decisión:</strong> mergeado al motor de producción con α=0.2 y lookback=1y. El cambio
            se aplica en{' '}
            <code className="rounded bg-bg-2/60 px-1 py-0.5 font-mono text-xs">match.ts</code>{' '}
            vía <code className="rounded bg-bg-2/60 px-1 py-0.5 font-mono text-xs">effectiveElo()</code>.
            Caveat: el efecto es chico y dentro del ruido posible con n=192. Confirmable expandiendo a
            WCs 1990-2010.
          </p>
        </div>
      </Section>

      <Section title="Tier 1 #3 · Modelo de penales">
        <p className="mb-4 max-w-3xl text-sm text-fg-2">
          El motor antes resolvía empates 0-0 en KO con una moneda al aire (50/50).
          Lo reemplazamos por un modelo Bayesian Empirical shrinkage sobre{' '}
          <strong className="text-fg-1">103 shootouts históricos</strong> en torneos top (Mundial, Eurocopa,
          Copa América, Copa Asia, AFCON):
        </p>
        <pre className="mb-4 overflow-x-auto rounded-xl border border-border bg-bg-1/60 px-4 py-3 font-mono text-xs leading-relaxed text-gold/95 tabular max-w-2xl">
{`rate(team) = (wins + k · 0.5) / (n + k)        k = 10
P(A gana) = rate(A) / (rate(A) + rate(B))`}
        </pre>
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <Stat
            label="Modelo · n=13 shootouts del backtest"
            value={(penEval.modelAccuracy * 100).toFixed(1) + '%'}
            tone={penEval.modelAccuracy > 0.55 ? 'good' : penEval.modelAccuracy > 0.5 ? 'mid' : 'bad'}
            subtitle={`Brier ${penEval.modelBrier.toFixed(4)}`}
          />
          <Stat
            label="Coin flip · baseline"
            value={(penEval.baselineAccuracy * 100).toFixed(1) + '%'}
            tone="mid"
            subtitle={`Brier ${penEval.baselineBrier.toFixed(4)}`}
          />
        </div>
        <PenaltyTable rows={penEval.rows} />
        <div className="mt-5 max-w-3xl space-y-3 text-sm text-fg-2">
          <p>
            <span className="text-rose font-medium">Honesto:</span> con n=13 shootouts el IC 95% de la
            accuracy es [26%, 81%]. El +3.8pp del modelo vs coin flip <strong className="text-fg-1">no es
            estadísticamente significativo</strong>. Brier es esencialmente igual.
          </p>
          <p>
            2018 fue devastador (0/4): Inglaterra rompió la curse, Rusia ganó como anfitrión, Croacia
            ganó dos seguidos. El modelo no podía saber. 2014 y 2022 fueron sólidos (3/4 y 4/5).
          </p>
          <p>
            <strong className="text-fg-1">Mergeado de todos modos.</strong> Razones: (1) filosóficamente
            más correcto que un coin flip ciego, (2) no empeora Brier de forma significativa, (3) en el
            video se vende mejor que "moneda al aire", (4) cuando expandamos el backtest a 1990-2010
            tendremos n≥40 shootouts y veremos si la señal es real. Si en ese punto Brier sube, retiramos.
          </p>
        </div>
      </Section>

      <Section title="Sweep · Host bonus">
        <p className="mb-4 max-w-3xl text-sm text-fg-2">
          El modelo actual le da <span className="text-fg-1 font-medium">+100 ELO</span> al equipo
          anfitrión solo en fase de grupos. Probamos varios valores (0 a 220) y dos políticas
          (solo grupos vs grupos + KO) para ver cuál minimiza Brier. Los <span className="text-fg-1">28
          partidos donde uno de los equipos es anfitrión</span> son los que cambian - el resto del dataset
          se mueve solo por efecto de redondeo.
        </p>
        <SweepChart points={sweep} />
        <div className="mt-5 max-w-3xl space-y-3 text-sm text-fg-2">
          <p>
            <span className="text-rose font-medium">Counter-intuición:</span> aumentar el bonus
            <strong className="text-fg-1"> empeora </strong>
            marginalmente el Brier en cada paso (0.595 → 0.608 al saltar de 0 a 220). Aplicarlo también
            en KO empeora aún más.
          </p>
          <p>
            <span className="text-fg-1">Pero</span> con n=28 partidos el error estándar de Brier es
            ~0.09 - todos los valores del sweep están dentro del ruido. Direccionalmente sugiere
            "menos bonus" pero no es estadísticamente decisivo. Los 3 hosts del set (BRA-2014, RUS-2018,
            QAT-2022) eran o ya-favoritos o demasiado débiles para que el bonus genérico ayudara.
          </p>
          <p className="text-fg-3">
            <strong>Próximo paso para concluir:</strong> expandir el backtest a Mundiales 1990-2010 (+6
            torneos = +36 partidos de host). Ahí sí va a haber poder estadístico para confirmar o
            descartar el bonus actual.
          </p>
        </div>
      </Section>

      <Section title="Peores predicciones - el modelo no vio venir">
        <MissList matches={r.worstMisses} kind="miss" />
        <p className="mt-3 text-xs leading-relaxed text-fg-3">
          Estos son los batacazos históricos. El modelo les asignó probabilidad muy baja y igual ocurrieron.
          La frecuencia con la que pasan vs lo que predijimos es donde está la mayor deuda - el Tier 1
          (peso al último año, lesiones, host bonus reforzado) ataca exactamente esto.
        </p>
      </Section>

      <Section title="Mejores predicciones - donde el ELO se impone">
        <MissList matches={r.bestCalls} kind="call" />
      </Section>

      <Section title="Cómo leer esto">
        <ul className="space-y-3 text-fg-1 leading-relaxed">
          <Bullet>
            <strong>Brier score</strong> mide el error cuadrático medio del vector de probabilidades.
            0 = predicción perfecta, 0.667 = predicción uniforme (random). Nuestro {r.overall.brier.toFixed(2)} significa{' '}
            que el modelo aporta señal real, pero deja plata sobre la mesa.
          </Bullet>
          <Bullet>
            <strong>Log loss</strong> penaliza más las predicciones confiadas y equivocadas. Es la métrica
            estándar en competencias de prediction markets. {r.overall.logLoss.toFixed(2)} ubica al modelo
            entre "pick favorite" y "modelo serio bien calibrado".
          </Bullet>
          <Bullet>
            <strong>Accuracy top-1</strong> = en qué % de partidos la clase con más probabilidad fue la que
            ocurrió. {(r.overall.accuracy * 100).toFixed(0)}% no parece mucho pero hay que recordar que
            "draw" es difícil de pronosticar (3 outcomes, no 2) y que en {(r.overall.count)} partidos el sesgo
            del torneo (presión, contraataques) le da chance al underdog.
          </Bullet>
          <Bullet>
            <strong>Por qué backtest sobre el regulation-time</strong>: nuestro modelo Poisson predice goles
            en 90 minutos. Los partidos definidos en alargue/penales se cuentan como empate al final del
            tiempo regular - que es exactamente lo que el modelo predice.
          </Bullet>
          <Bullet>
            <strong>Lo que NO incluye este backtest</strong>: predicciones a nivel torneo (probabilidad de
            campeón) - requiere correr el bracket de 32 equipos. Lo agregamos en Tier 1.5 cuando esté
            implementado el formato viejo del Mundial.
          </Bullet>
        </ul>
      </Section>

      <footer className="mt-16 border-t border-border pt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">
        Datos · ELO de eloratings.net (snapshot fin de año previo) · Resultados de openfootball/worldcup.json
      </footer>
    </article>
  );
}

const STAGE_LABEL: Record<string, string> = {
  group: 'Fase de grupos',
  r16: 'Octavos',
  qf: 'Cuartos',
  sf: 'Semis',
  '3rd': 'Tercer puesto',
  final: 'Final',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 border-t border-border pt-10">
      <h2 className="font-display text-2xl font-bold tracking-tight text-fg-0">{title}</h2>
      <div className="mt-5 space-y-1">{children}</div>
    </section>
  );
}

function Stat({ label, value, subtitle, tone }: { label: string; value: string; subtitle: string; tone: 'good' | 'mid' | 'bad' }) {
  return (
    <div className={cn(
      'rounded-2xl border p-6 glass',
      tone === 'good' && 'border-emerald/30',
      tone === 'mid' && 'border-gold/30',
      tone === 'bad' && 'border-rose/30',
    )}>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">{label}</div>
      <div className={cn(
        'mt-2 font-display text-4xl font-bold tabular',
        tone === 'good' && 'text-emerald',
        tone === 'mid' && 'text-gold',
        tone === 'bad' && 'text-rose',
      )}>
        {value}
      </div>
      <div className="mt-1 font-mono text-[10px] text-fg-3">{subtitle}</div>
    </div>
  );
}

function PenaltyTable({ rows }: { rows: PenaltyEvalRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border glass">
      <table className="min-w-full">
        <thead className="text-[10px] uppercase tracking-[0.18em] text-fg-3 font-mono">
          <tr>
            <th className="px-4 py-3 text-left">Año</th>
            <th className="px-3 py-3 text-left">Etapa</th>
            <th className="px-4 py-3 text-left">Local (n, rate)</th>
            <th className="px-4 py-3 text-left">Visitante (n, rate)</th>
            <th className="px-3 py-3 text-right">P(local)</th>
            <th className="px-3 py-3 text-left">Modelo</th>
            <th className="px-3 py-3 text-left">Real</th>
            <th className="px-3 py-3 text-center">✓/✗</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cn('border-t border-border/40', r.correct && 'bg-emerald-lo/5')}>
              <td className="px-4 py-2 font-mono text-xs tabular text-fg-2">{r.year}</td>
              <td className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-fg-3">{r.stage}</td>
              <td className="px-4 py-2 text-sm">
                <span className="font-medium text-fg-1">{r.home}</span>
                <span className="ml-1 font-mono text-[10px] text-fg-3">({r.nHome}, {(r.rateHome * 100).toFixed(0)}%)</span>
              </td>
              <td className="px-4 py-2 text-sm">
                <span className="font-medium text-fg-1">{r.away}</span>
                <span className="ml-1 font-mono text-[10px] text-fg-3">({r.nAway}, {(r.rateAway * 100).toFixed(0)}%)</span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs tabular text-fg-0">{(r.pHome * 100).toFixed(0)}%</td>
              <td className="px-3 py-2 text-sm text-fg-1">{r.modelPicked === 'home' ? r.home : r.away}</td>
              <td className="px-3 py-2 text-sm text-fg-0 font-medium">{r.actual === 'home' ? r.home : r.away}</td>
              <td className={cn(
                'px-3 py-2 text-center font-mono text-sm',
                r.correct ? 'text-emerald' : 'text-rose',
              )}>
                {r.correct ? '✓' : '✗'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentFormHeatmap({ cells }: { cells: RecentFormSweepCell[] }) {
  const alphas = [...new Set(cells.map((c) => c.alpha))].sort((a, b) => a - b);
  const lookbacks = [...new Set(cells.map((c) => c.lookbackYears))].sort((a, b) => a - b);
  const briers = cells.map((c) => c.overall.brier);
  const minBrier = Math.min(...briers);
  const maxBrier = Math.max(...briers);
  // Color scale: lower = better (emerald), higher = worse (rose).
  const cellAt = (alpha: number, lb: number) => cells.find((c) => c.alpha === alpha && c.lookbackYears === lb)!;
  const colorFor = (b: number) => {
    if (maxBrier === minBrier) return 'oklch(0.60 0.10 180 / 0.3)';
    const t = (b - minBrier) / (maxBrier - minBrier);  // 0 = best, 1 = worst
    // Interpolate hue from emerald (155) → rose (18), lightness boost on extremes
    if (t < 0.5) {
      // emerald → neutral
      const alpha = 0.55 - t * 0.7;
      return `oklch(0.65 0.15 155 / ${alpha.toFixed(2)})`;
    } else {
      const alpha = 0.20 + (t - 0.5) * 0.9;
      return `oklch(0.62 0.20 18 / ${alpha.toFixed(2)})`;
    }
  };
  const best = cells.reduce((m, c) => (c.overall.brier < m.overall.brier ? c : m), cells[0]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border glass p-4">
      <table className="mx-auto font-mono text-xs tabular">
        <thead>
          <tr>
            <th className="px-3 py-2 text-fg-3 text-[10px] uppercase tracking-[0.18em]">lookback ↓ / α →</th>
            {alphas.map((a) => (
              <th key={a} className="px-3 py-2 text-fg-3 text-[10px] uppercase tracking-[0.18em] text-center min-w-[80px]">
                {a.toFixed(2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lookbacks.map((lb) => (
            <tr key={lb}>
              <td className="px-3 py-2 text-fg-3 text-[10px] uppercase tracking-[0.18em]">{lb} año{lb > 1 ? 's' : ''}</td>
              {alphas.map((a) => {
                const c = cellAt(a, lb);
                const isBest = c === best;
                return (
                  <td key={a} className="px-2 py-1 text-center">
                    <div
                      className={cn(
                        'rounded-lg px-3 py-3 transition-all',
                        isBest && 'ring-2 ring-emerald shadow-[0_0_24px_-4px_oklch(0.72_0.17_155/0.6)]',
                      )}
                      style={{ background: colorFor(c.overall.brier) }}
                    >
                      <div className="text-fg-0 font-medium">{c.overall.brier.toFixed(4)}</div>
                      <div className="mt-0.5 text-fg-2 text-[10px]">{(c.overall.accuracy * 100).toFixed(1)}%</div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-center gap-6 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">
        <span className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm" style={{ background: 'oklch(0.65 0.15 155 / 0.55)' }} />mejor</span>
        <span className="flex items-center gap-2"><span className="h-2 w-4 rounded-sm" style={{ background: 'oklch(0.62 0.20 18 / 0.55)' }} />peor</span>
        <span className="text-fg-2">★ óptimo: α={best.alpha}, lookback={best.lookbackYears}y</span>
      </div>
    </div>
  );
}

function SweepChart({ points }: { points: SweepPoint[] }) {
  const W = 720, H = 280, PAD_L = 56, PAD_R = 24, PAD_T = 20, PAD_B = 44;
  const series = {
    groupOnly: points.filter((p) => !p.applyInKO),
    plusKO:    points.filter((p) =>  p.applyInKO),
  };
  const bonuses = series.groupOnly.map((p) => p.hostBonus);
  const minBonus = Math.min(...bonuses), maxBonus = Math.max(...bonuses);
  const allBrier = points.map((p) => p.hostOnly.brier);
  const minY = Math.min(...allBrier) - 0.005;
  const maxY = Math.max(...allBrier) + 0.005;

  const x = (b: number) => PAD_L + (b - minBonus) / (maxBonus - minBonus) * (W - PAD_L - PAD_R);
  const y = (br: number) => PAD_T + (maxY - br) / (maxY - minY) * (H - PAD_T - PAD_B);

  const path = (pts: SweepPoint[]) => pts.map((p, i) =>
    (i === 0 ? 'M' : 'L') + ' ' + x(p.hostBonus).toFixed(1) + ' ' + y(p.hostOnly.brier).toFixed(1)
  ).join(' ');

  return (
    <div className="rounded-2xl border border-border glass p-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[280px] w-full">
        {/* axes */}
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="oklch(0.34 0.04 180)" strokeWidth={1} />
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="oklch(0.34 0.04 180)" strokeWidth={1} />
        {/* x ticks */}
        {bonuses.map((b) => (
          <g key={`xt-${b}`}>
            <line x1={x(b)} x2={x(b)} y1={H - PAD_B} y2={H - PAD_B + 4} stroke="oklch(0.34 0.04 180)" />
            <text x={x(b)} y={H - PAD_B + 16} fontSize={10} fontFamily="JetBrains Mono, monospace" fill="oklch(0.62 0.018 180)" textAnchor="middle">{b}</text>
          </g>
        ))}
        {/* y ticks (5 evenly spaced) */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const v = minY + t * (maxY - minY);
          return (
            <g key={`yt-${t}`}>
              <line x1={PAD_L - 4} x2={PAD_L} y1={y(v)} y2={y(v)} stroke="oklch(0.34 0.04 180)" />
              <text x={PAD_L - 8} y={y(v) + 3} fontSize={10} fontFamily="JetBrains Mono, monospace" fill="oklch(0.62 0.018 180)" textAnchor="end">{v.toFixed(3)}</text>
            </g>
          );
        })}
        {/* axis titles */}
        <text x={(W + PAD_L - PAD_R) / 2} y={H - 6} fontSize={11} fontFamily="JetBrains Mono, monospace" fill="oklch(0.46 0.02 180)" textAnchor="middle">host bonus (ELO points)</text>
        <text x={14} y={(H - PAD_B + PAD_T) / 2} fontSize={11} fontFamily="JetBrains Mono, monospace" fill="oklch(0.46 0.02 180)" textAnchor="middle" transform={`rotate(-90 14 ${(H - PAD_B + PAD_T) / 2})`}>Brier (host-only, n=28)</text>

        {/* group-only line (default behavior) */}
        <path d={path(series.groupOnly)} stroke="oklch(0.76 0.13 180)" strokeWidth={2} fill="none" />
        {series.groupOnly.map((p) => (
          <circle key={`g-${p.hostBonus}`} cx={x(p.hostBonus)} cy={y(p.hostOnly.brier)} r={3.5} fill="oklch(0.76 0.13 180)" />
        ))}
        {/* plus-KO line */}
        <path d={path(series.plusKO)} stroke="oklch(0.65 0.22 18)" strokeWidth={2} fill="none" strokeDasharray="4 3" />
        {series.plusKO.map((p) => (
          <circle key={`k-${p.hostBonus}`} cx={x(p.hostBonus)} cy={y(p.hostOnly.brier)} r={3.5} fill="oklch(0.65 0.22 18)" />
        ))}
        {/* current marker */}
        <line x1={x(100)} x2={x(100)} y1={PAD_T} y2={H - PAD_B} stroke="oklch(0.62 0.018 180)" strokeDasharray="2 3" strokeWidth={1} />
        <text x={x(100) + 4} y={PAD_T + 10} fontSize={9} fontFamily="JetBrains Mono, monospace" fill="oklch(0.62 0.018 180)">actual (100)</text>
      </svg>
      <div className="mt-2 flex justify-center gap-6 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-2">
        <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-gold" />solo grupos</span>
        <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-rose" style={{ borderTop: '1px dashed' }} />grupos + KO</span>
      </div>
    </div>
  );
}

function CalibrationPlot({ buckets }: { buckets: CalibrationBucket[] }) {
  const W = 320, H = 320, PAD = 30;
  const x = (p: number) => PAD + p * (W - 2 * PAD);
  const y = (p: number) => H - PAD - p * (H - 2 * PAD);

  return (
    <div className="rounded-2xl border border-border glass p-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-[320px] w-full max-w-[400px]">
        {/* axes */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="oklch(0.34 0.04 180)" strokeWidth={1} />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="oklch(0.34 0.04 180)" strokeWidth={1} />
        {/* perfect calibration diagonal */}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="oklch(0.46 0.02 180)" strokeWidth={1} strokeDasharray="3 3" />
        {/* axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <text x={x(t)} y={H - PAD + 14} fontSize={9} fontFamily="JetBrains Mono, monospace" fill="oklch(0.62 0.018 180)" textAnchor="middle">{(t * 100).toFixed(0)}%</text>
            <text x={PAD - 6} y={y(t) + 3} fontSize={9} fontFamily="JetBrains Mono, monospace" fill="oklch(0.62 0.018 180)" textAnchor="end">{(t * 100).toFixed(0)}%</text>
          </g>
        ))}
        {/* axis titles */}
        <text x={W / 2} y={H - 4} fontSize={10} fontFamily="JetBrains Mono, monospace" fill="oklch(0.46 0.02 180)" textAnchor="middle">predicho</text>
        <text x={10} y={H / 2} fontSize={10} fontFamily="JetBrains Mono, monospace" fill="oklch(0.46 0.02 180)" textAnchor="middle" transform={`rotate(-90 10 ${H / 2})`}>observado</text>
        {/* points + segments */}
        {buckets.filter((b) => b.count > 0).map((b, i) => {
          const r = Math.max(3, Math.min(12, Math.sqrt(b.count) * 0.6));
          return (
            <g key={i}>
              <circle cx={x(b.predicted)} cy={y(b.observed)} r={r} fill="oklch(0.76 0.13 180 / 0.7)" stroke="oklch(0.76 0.13 180)" strokeWidth={1} />
            </g>
          );
        })}
      </svg>
      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">
        Cada bola es un bucket. Tamaño ∝ √(n samples).
      </p>
    </div>
  );
}

function MissList({ matches, kind }: { matches: ScoredMatch[]; kind: 'miss' | 'call' }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border glass">
      <table className="min-w-full">
        <thead className="text-[10px] uppercase tracking-[0.18em] text-fg-3 font-mono">
          <tr>
            <th className="px-4 py-3 text-left">Mundial</th>
            <th className="px-3 py-3 text-left">Etapa</th>
            <th className="px-4 py-3 text-left">Partido</th>
            <th className="px-3 py-3 text-right">Predicha</th>
            <th className="px-3 py-3 text-right">P(resultado real)</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m, i) => {
            const pVec = [m.pred.pHome, m.pred.pDraw, m.pred.pAway];
            const predicted = ['home', 'draw', 'away'][m.predictedClass];
            const PRED_LABEL: Record<string, string> = { home: m.home, draw: 'empate', away: m.away };
            const actualResult = m.gh > m.ga ? `gana ${m.home}` : m.gh === m.ga ? 'empate' : `gana ${m.away}`;
            return (
              <tr key={i} className="border-t border-border/40">
                <td className="px-4 py-2.5 font-mono text-xs text-fg-2 tabular">{m.year}</td>
                <td className="px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-fg-3">{m.stage}</td>
                <td className="px-4 py-2.5 text-sm">
                  <span className={cn('font-medium', m.gh > m.ga ? 'text-fg-0' : 'text-fg-2')}>{m.home}</span>
                  <span className="mx-2 font-mono text-xs tabular text-fg-1">{m.gh} - {m.ga}</span>
                  <span className={cn('font-medium', m.ga > m.gh ? 'text-fg-0' : 'text-fg-2')}>{m.away}</span>
                  <span className="ml-3 font-mono text-[10px] text-fg-3">→ {actualResult}</span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-fg-2">
                  {PRED_LABEL[predicted]} ({(Math.max(...pVec) * 100).toFixed(0)}%)
                </td>
                <td className={cn(
                  'px-3 py-2.5 text-right font-mono text-xs tabular font-medium',
                  kind === 'miss' ? 'text-rose' : 'text-emerald',
                )}>
                  {(m.pActual * 100).toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-fg-1">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
      <span>{children}</span>
    </li>
  );
}
