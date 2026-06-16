import { SensorHistory } from '../types';

export const exportSensorHistoryToCSV = (history: SensorHistory[]): string => {
  const headers = ['笼位ID', '时间', '温度(°C)', '湿度(%)'];
  
  const rows = history.map(h => [
    h.cageId,
    h.time.toISOString(),
    h.temperature.toFixed(1),
    h.humidity.toFixed(1),
  ]);
  
  const csvContent = [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');
  
  const BOM = '\uFEFF';
  return BOM + csvContent;
};

export const downloadCSV = (csvContent: string, filename: string): void => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};
