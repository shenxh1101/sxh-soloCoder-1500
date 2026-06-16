import { Cage, FeedRecord, DailyReport, SensorHistory } from '../types';

export const generateDailyReport = (
  cages: Cage[],
  feedRecords: FeedRecord[],
  sensorHistory: SensorHistory[]
): DailyReport => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const todayHistory = sensorHistory.filter(
    h => h.time >= todayStart
  );
  
  const todayRecords = feedRecords.filter(
    r => r.time >= todayStart
  );
  
  let maxTemp = -Infinity;
  let minTemp = Infinity;
  let totalHumidity = 0;
  let humidityCount = 0;
  
  todayHistory.forEach(h => {
    if (h.temperature > maxTemp) maxTemp = h.temperature;
    if (h.temperature < minTemp) minTemp = h.temperature;
    totalHumidity += h.humidity;
    humidityCount++;
  });
  
  const feedCountByCage: Record<string, number> = {};
  cages.forEach(cage => {
    feedCountByCage[cage.id] = cage.feedCount;
  });
  
  const totalFeedCount = Object.values(feedCountByCage).reduce((a, b) => a + b, 0);
  
  const alertCount = cages.filter(c => c.hasAlert).length;
  
  return {
    date: todayStr,
    maxTemperature: parseFloat(maxTemp.toFixed(1)),
    minTemperature: parseFloat(minTemp.toFixed(1)),
    avgHumidity: humidityCount > 0 ? parseFloat((totalHumidity / humidityCount).toFixed(1)) : 0,
    feedCountByCage,
    totalFeedCount,
    alertCount,
  };
};

export const formatReportAsText = (report: DailyReport): string => {
  const lines = [
    '===== 养殖日报 =====',
    `日期: ${report.date}`,
    '',
    `最高温度: ${report.maxTemperature}°C`,
    `最低温度: ${report.minTemperature}°C`,
    `平均湿度: ${report.avgHumidity}%`,
    `总投料次数: ${report.totalFeedCount}`,
    `当前异常笼位数: ${report.alertCount}`,
    '',
    '各笼位投料次数:',
  ];
  
  Object.entries(report.feedCountByCage)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([cageId, count]) => {
      lines.push(`  ${cageId}: ${count} 次`);
    });
  
  return lines.join('\n');
};
