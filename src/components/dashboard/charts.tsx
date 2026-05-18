"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/content-blocks";

const palette = ["#7c9cff", "#ffb454", "#f472b6", "#38bdf8"];
const chartInitialDimension = { width: 640, height: 256 };
const donutInitialDimension = { width: 320, height: 208 };

type EngagementPoint = {
  label: string;
  engagement: number;
};

type AttendancePoint = {
  label: string;
  present: number;
  absent: number;
};

type DonutPoint = {
  name: string;
  value: number;
};

export function EngagementChart({ data = [] }: { data?: EngagementPoint[] }) {
  return (
    <Card className="min-h-[360px]">
      <CardHeader>
        <CardTitle>Engagement Pulse</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState
            variant="activity"
            message="No engagement chart data available yet."
          />
        ) : (
          <div className="h-64">
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={chartInitialDimension}
            >
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="engagement" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#7c9cff" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#7c9cff" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "18px",
                  }}
                />
                <Area
                  dataKey="engagement"
                  type="monotone"
                  stroke="#7c9cff"
                  strokeWidth={3}
                  fill="url(#engagement)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AttendanceChart({ data = [] }: { data?: AttendancePoint[] }) {
  return (
    <Card className="min-h-[360px]">
      <CardHeader>
        <CardTitle>Attendance Analytics</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState
            variant="schedule"
            message="No attendance chart data available yet."
          />
        ) : (
          <div className="h-64">
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={chartInitialDimension}
            >
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="4 8" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "18px",
                  }}
                />
                <Bar dataKey="present" radius={[10, 10, 4, 4]} fill="#7c9cff" />
                <Bar dataKey="absent" radius={[10, 10, 4, 4]} fill="#ffb454" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CompletionDonut({ data = [] }: { data?: DonutPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assignment Status</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState
            variant="assignments"
            message="No assignment status chart data available yet."
          />
        ) : (
          <>
            <div className="h-52">
              <ResponsiveContainer
                width="100%"
                height="100%"
                initialDimension={donutInitialDimension}
              >
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={4}
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={palette[index % palette.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "18px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {data.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: palette[index % palette.length] }}
                  />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="ml-auto font-semibold">{item.value}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
