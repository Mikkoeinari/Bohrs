awk '/<p className="text-\[10px\] text-slate-500 font-mono uppercase tracking-widest">\{vehicle.type\}<\/p>/ {
  print $0
  print "                      <div className=\"mt-1 flex items-center gap-2\">"
  print "                        <span className=\"text-[9px] font-mono font-bold text-slate-500\">BASE:</span>"
  print "                        <select value={vehicle.currentBuildingId || \047player-hq\047} onChange={(e) => setVehicleBase(vehicle.id, e.target.value)} disabled={vehicle.status !== \047READY\047} className=\"bg-slate-900 text-white font-mono text-[9px] px-1 py-0.5 outline-none border border-slate-700 rounded-sm disabled:opacity-50\">"
  print "                          {Object.values(state.buildings).filter(b => b.ownerId === \047player\047).map(b => ("
  print "                            <option key={b.id} value={b.id}>{b.name}</option>"
  print "                          ))}"
  print "                        </select>"
  print "                      </div>"
  next
}1' src/components/VehicleManagement.tsx > src/components/VehicleManagement.tmp
mv src/components/VehicleManagement.tmp src/components/VehicleManagement.tsx
