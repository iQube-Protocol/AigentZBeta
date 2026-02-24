/**
 * Chart Viewer
 * 
 * Renders interactive charts using Recharts with theme support
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  RadarChart,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from "recharts";
import type { ChartData } from "@/app/types/nakamoto";

interface ChartViewerProps {
  chart: ChartData;
  theme?: 'light' | 'dark';
  interactive?: boolean;
}

export function ChartViewer({ chart, theme = 'dark', interactive = true }: ChartViewerProps) {
  const colors = chart.config?.colors || [
    '#00bcd4', '#ff4081', '#4caf50', '#ff9800', '#9c27b0', '#2196f3'
  ];
  const sample = chart.data?.[0] as Record<string, any> | undefined;
  const sampleKeys = sample ? Object.keys(sample) : [];
  const xKey = chart.config?.xAxis ?? sampleKeys[0] ?? 'name';
  const yKey = chart.config?.yAxis ?? sampleKeys[1] ?? sampleKeys[0] ?? 'value';

  const renderChart = () => {
    const commonProps = {
      data: chart.data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (chart.type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#e0e0e0'} />
            <XAxis dataKey={xKey} stroke={theme === 'dark' ? '#fff' : '#000'} />
            <YAxis stroke={theme === 'dark' ? '#fff' : '#000'} />
            <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff' }} />
            <Legend />
            <Line type="monotone" dataKey={yKey} stroke={colors[0]} strokeWidth={2} />
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#e0e0e0'} />
            <XAxis dataKey={xKey} stroke={theme === 'dark' ? '#fff' : '#000'} />
            <YAxis stroke={theme === 'dark' ? '#fff' : '#000'} />
            <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff' }} />
            <Legend />
            <Bar dataKey={yKey} fill={colors[0]} />
          </BarChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={chart.data}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey={yKey}
            >
              {chart.data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff' }} />
            <Legend />
          </PieChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#e0e0e0'} />
            <XAxis dataKey={xKey} stroke={theme === 'dark' ? '#fff' : '#000'} />
            <YAxis stroke={theme === 'dark' ? '#fff' : '#000'} />
            <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff' }} />
            <Area type="monotone" dataKey={yKey} stroke={colors[0]} fill={colors[0]} fillOpacity={0.6} />
          </AreaChart>
        );

      default:
        return <div className="flex items-center justify-center h-full text-muted-foreground">Unsupported chart type</div>;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">{chart.title}</CardTitle>
          <Badge variant="outline">{chart.type}</Badge>
        </div>
        {chart.metadata?.description && (
          <p className="text-sm text-muted-foreground">{chart.metadata.description}</p>
        )}
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
