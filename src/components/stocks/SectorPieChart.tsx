import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(142 70% 45%)',
  'hsl(200 70% 50%)',
  'hsl(280 60% 55%)',
];

interface SectorPieChartProps {
  data: { name: string; value: number }[];
  totalValue: number;
}

export function SectorPieChart({ data, totalValue }: SectorPieChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No holdings to display
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-center gap-4">
      <div className="w-48 h-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`$${value.toFixed(0)}`, 'Value']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {data.map((entry, i) => {
          const pct = totalValue > 0 ? ((entry.value / totalValue) * 100).toFixed(1) : '0';
          return (
            <div key={entry.name} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="truncate flex-1 text-foreground">{entry.name}</span>
              <span className="text-muted-foreground shrink-0">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
