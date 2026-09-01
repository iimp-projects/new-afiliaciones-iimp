//  if (activeTab === "historial") {
//       const timelineEvents = generateTimeline(payload);
//       return (
//         <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
//           <h3 className="text-[15px] font-black text-slate-800 mb-8 flex items-center gap-3 border-b border-slate-100 pb-3">
//             <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
//               <Activity size={16} className="text-slate-600" />
//             </div>
//             Historial de Auditoría
//           </h3>
//           <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-4">
//             {timelineEvents.map((event, i) => (
//               <div key={i} className="relative pl-8">
//                 <div
//                   className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center shadow-sm ${event.color}`}
//                 >
//                   {event.icon}
//                 </div>
//                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
//                   <h4 className="text-sm font-bold text-slate-800">
//                     {event.title}
//                   </h4>
//                   <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md w-max">
//                     {event.date.toLocaleString("es-PE", {
//                       dateStyle: "long",
//                       timeStyle: "short",
//                     })}
//                   </span>
//                 </div>
//                 {event.auditor && (
//                   <span className="inline-block mt-1 mb-2 px-2.5 py-1 bg-slate-100 text-[#C5A059] text-[10px] font-black rounded uppercase tracking-wider border border-[#e8d09e]">
//                     {event.auditor.includes("SISTEMA")
//                       ? "Ejecutado por:"
//                       : "Validado por:"}{" "}
//                     {event.auditor}
//                   </span>
//                 )}
//                 <p className="text-[13px] font-medium text-slate-600 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100">
//                   {event.desc}
//                 </p>
//               </div>
//             ))}
//           </div>
//         </div>
//       );
//     }