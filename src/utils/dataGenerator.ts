import { Cage, SensorHistory } from '../types';

export const generateInitialCages = (): Cage[] => {
  const cages: Cage[] = [];
  for (let floor = 1; floor <= 3; floor++) {
    for (let position = 1; position <= 8; position++) {
      const id = `F${floor}-P${position}`;
      cages.push({
        id,
        floor,
        position,
        temperature: 22 + Math.random() * 8,
        humidity: 55 + Math.random() * 20,
        lastFeedTime: null,
        feedCount: 0,
        hasAlert: false,
        alertType: null,
        isSelected: false,
      });
    }
  }
  return cages;
};

export const generateSensorData = (currentTemp: number, currentHumidity: number): { temperature: number; humidity: number } => {
  const tempChange = (Math.random() - 0.5) * 1.5;
  const humidityChange = (Math.random() - 0.5) * 3;
  
  let newTemp = currentTemp + tempChange;
  let newHumidity = currentHumidity + humidityChange;
  
  newTemp = Math.max(15, Math.min(35, newTemp));
  newHumidity = Math.max(30, Math.min(85, newHumidity));
  
  if (Math.random() < 0.02) {
    if (Math.random() < 0.5) {
      newTemp = 36 + Math.random() * 4;
    } else {
      newHumidity = 86 + Math.random() * 8;
    }
  }
  
  return {
    temperature: parseFloat(newTemp.toFixed(1)),
    humidity: parseFloat(newHumidity.toFixed(1)),
  };
};

export const generate24HourHistory = (cages: Cage[]): SensorHistory[] => {
  const history: SensorHistory[] = [];
  const now = new Date();
  
  for (let hour = 24; hour >= 0; hour--) {
    const time = new Date(now.getTime() - hour * 60 * 60 * 1000);
    cages.forEach(cage => {
      const baseTemp = 22 + Math.random() * 8;
      const baseHumidity = 55 + Math.random() * 20;
      history.push({
        cageId: cage.id,
        time,
        temperature: parseFloat((baseTemp + (Math.random() - 0.5) * 2).toFixed(1)),
        humidity: parseFloat((baseHumidity + (Math.random() - 0.5) * 5).toFixed(1)),
      });
    });
  }
  
  return history;
};

export const getCagePosition = (floor: number, position: number): { x: number; y: number; z: number } => {
  const cageWidth = 1.5;
  const cageHeight = 1.2;
  const floorHeight = 1.5;
  const startX = -(cageWidth * 3.5);
  
  return {
    x: startX + (position - 1) * cageWidth,
    y: 0.6 + (floor - 1) * floorHeight,
    z: 0,
  };
};
