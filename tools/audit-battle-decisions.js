'use strict';
const fs=require('node:fs'),path=require('node:path');
const G=require('./build-great-league-meta-database'),R=require('./run-battle-regressions');
const Mechanical=require('./audit-automatic-battle'),A=require('../src/analysis/battle-alternatives');
const S=require('../src/analysis/battle-sensitivity'),Reliability=require('../src/reliability/battle-reliability');
const runtime=R.createRuntime(),source=G.extractLiveWorkerSource();
const ordinary=G.createWorkerAdapter(source,{dreStandard:true,strict:true}),probe=G.createWorkerAdapter(A.instrumentWorkerSource(source),{dreStandard:true,strict:true});
const all=Mechanical.buildCases(runtime),cases=all.filter(c=>c.id.startsWith('golden--') || c.id.startsWith('reported-rosters--') && c.shields===1);
let sequence=0;
const report={engine:Reliability.BATTLE_ENGINE_VERSION,generatedAt:new Date().toISOString(),scope:'Legal single-choice replies with fixed-prefix replay, including shields, charged alternatives and one/two extra Fast moves. Not an optimal-play proof.',cases:[],failures:[]};
for(const item of cases){
  const payload={key:item.id,config:item.config,aShields:item.shields,bShields:item.bShields??item.shields,preFastAdvantage:item.preFastAdvantage,includeSwing:false,trace:true,debugTimeline:true};
  const plain=ordinary.simulate({...payload,id:++sequence});
  const baseline=probe.simulate({...payload,id:++sequence,alternativeProbe:{targets:[]}});
  // timelineTrace is a compact export (e.g. it omits charge.shielded).
  // Compare like-for-like exports first; then validate the full probe ledger.
  const expected={outcome:plain.details.outcome,...plain.decisionTrace.finalState,timeline:A.timelineIdentity(baseline.alternativeProbe.timeline)};
  const errors=Reliability.validateTrace(plain.decisionTrace);
  if(!A.baselineMatches(baseline,expected))errors.push('Canonical baseline mismatch.');
  if(JSON.stringify(A.timelineIdentity(plain.timelineTrace))!==JSON.stringify(A.timelineIdentity(baseline.timelineTrace)))errors.push('Canonical event export mismatch.');
  const sensitivity=S.check(baseline,targets=>probe.simulate({...payload,id:++sequence,alternativeProbe:{targets}}),{expected,maxCandidates:Infinity});
  if(sensitivity.status==='incomplete')errors.push('Incomplete sensitivity check.');
  if(errors.length)report.failures.push({id:item.id,errors});
  report.cases.push({id:item.id,outcome:plain.details.outcome,...sensitivity});
  console.log(`${report.cases.length}/${cases.length} ${item.id}: ${sensitivity.status}, ${sensitivity.checked} replies`);
}
report.totals={cases:cases.length,checked:report.cases.reduce((n,c)=>n+c.checked,0),replyChecks:report.cases.reduce((n,c)=>n+c.replyChecks,0),sensitive:report.cases.filter(c=>c.status==='sensitive').length,failures:report.failures.length};
const file=path.resolve(__dirname,'../reports/simulator-review-20261005/decisions.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.totals));if(report.failures.length)process.exitCode=1;
