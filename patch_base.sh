sed -i 's/const hqSectorsCount = currentBuildingSectors.filter/const hqSectorsCount = baseSectors.filter/g' src/components/BaseManagement.tsx
sed -i 's/const conqueredSectorsCount = currentBuildingSectors.filter/const conqueredSectorsCount = baseSectors.filter/g' src/components/BaseManagement.tsx
sed -i 's/const currentBuildingSectors = currentBuildingSectors.filter/const currentBuildingSectors = baseSectors.filter/g' src/components/BaseManagement.tsx
