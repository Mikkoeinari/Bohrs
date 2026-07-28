sed -i 's/let activeVehicle = state/activeVehicle = state/g' src/components/CityMap.tsx
sed -i '158s/const activeVehicle/let activeVehicle/' src/components/CityMap.tsx
