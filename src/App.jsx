import React, { useEffect, useMemo, useState } from "react";
import Parser from "web-tree-sitter";

const SAMPLE_CPP = `#include <vector>
int sum(const std::vector<int>& a){
  int s=0;
  for(size_t i=0;i<a.size();++i) s += a[i];
  return s;
}

int pairSumBruteforce(std::vector<int>& a){
  for(size_t i=0;i<a.size();++i)
    for(size_t j=i+1;j<a.size();++j)
      if(a[i]+a[j]==0) return 1;
  return 0;
}

int fib(int n){
  if(n<=1) return n;
  return fib(n-1)+fib(n-2);
}
`;

const SAMPLE_JAVA = `class Example {
  int sum(int[] a){
    int s=0;
    for(int x: a) s+=x;
    return s;
  }
}`;

const SAMPLE_PY = `def sum(a):
    s=0
    for x in a:
        s+=x
    return s
`;

export default function App(){
  const [lang, setLang] = useState("cpp");
  const [code, setCode] = useState(SAMPLE_CPP);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [tsReady, setTsReady] = useState(false);
  const [cppLang, setCppLang] = useState(null);

  useEffect(() => {
  let mounted = true;
  (async () => {
    try {
      const base = import.meta.env.BASE_URL || "/";
      await Parser.init({
        locateFile: (name) =>
          name === "tree-sitter.wasm"
            ? `${base}parsers/tree-sitter.wasm`
            : name
      });

      const langMod = await Parser.Language.load(
        `${base}parsers/tree-sitter-cpp.wasm`
      );

      if (mounted) {
        setCppLang(langMod);
        setTsReady(true);
      }
    } catch (e) {
      setError(
        "Tree-sitter failed to initialize: " + String(e)
      );
    }
  })();
  return () => { mounted = false; };
}, []);

  useEffect(()=>{
    if(lang === "cpp") setCode(SAMPLE_CPP);
    if(lang === "java") setCode(SAMPLE_JAVA);
    if(lang === "python") setCode(SAMPLE_PY);
  },[lang]);

  async function analyze(){
    setError("");
    setResult(null);
    if(lang === "cpp"){
      if(!tsReady || !cppLang){
        setError("C++ parser not ready. Place tree-sitter-cpp.wasm into public/parsers/ and reload.");
        return;
      }
      try{
        const parser = new Parser();
        parser.setLanguage(cppLang);
        const tree = parser.parse(code);
        const res = analyzeCppTree(tree, code);
        setResult(res);
      }catch(e){
        setError(String(e));
      }
      return;
    }
    // fallbacks for java/python
    setResult(analyzeFallback(lang, code));
  }

  const headline = useMemo(()=>{
    if(!result) return "Paste code and click Analyze";
    const s = result.summary;
    return `${s.time} | ${s.space} | loops: ${s.totalLoops} | decisions: ${s.totalDecisions} | depth: ${s.maxLoopDepth}`;
  },[result]);

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="h1">Complexity Analyzer</div>
          <div className="small">C++ first (Tree-sitter in browser). Java/Python fallback.</div>
        </div>
        <div className="row">
          <div className="badge">Heuristic & AST</div>
        </div>
      </div>

      <div className="card">
        <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:12}}>
          <div>
            <label className="small">Your code</label>
            <textarea value={code} onChange={e=>setCode(e.target.value)} />
          </div>
          <div className="controls">
            <label className="small">Language</label>
            <select className="select" value={lang} onChange={e=>setLang(e.target.value)}>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
              <option value="python">Python</option>
            </select>
            <button onClick={analyze}>Analyze</button>
            {error && <div className="small" style={{color:"crimson",whiteSpace:"pre-wrap"}}>{error}</div>}
            <div className="small" style={{marginTop:8}}>Place tree-sitter wasm at <code>/parsers/tree-sitter-cpp.wasm</code></div>
          </div>
        </div>
      </div>

      <div style={{height:12}} />

      <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:12}}>
        <div className="card">
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div style={{fontWeight:600}}>Summary</div>
            <div className="small">{headline}</div>
          </div>

          {result ? (
            <>
              <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginTop:12}}>
                <Stat title="Time" value={result.summary.time} />
                <Stat title="Space" value={result.summary.space} />
                <Stat title="Max loop depth" value={result.summary.maxLoopDepth} />
                <Stat title="Recursion fns" value={result.summary.recursionCount} />
              </div>

              <div style={{marginTop:12}}>
                <div style={{fontWeight:600, marginBottom:8}}>Hotspots</div>
                {result.hotspots.length ? result.hotspots.map((h,i)=>(
                  <div key={i} className="hotspot" style={{marginBottom:8}}>
                    <div>
                      <div style={{fontWeight:600}}>{h.name}</div>
                      <div className="small">{h.snippet ? h.snippet.split("\n").slice(0,3).join("\n") : ""}</div>
                    </div>
                    <div className="small">{h.at} · score {h.score}</div>
                  </div>
                )) : <div className="small">No hotspots detected</div>}
              </div>

              <div style={{marginTop:12}}>
                <div style={{fontWeight:600, marginBottom:8}}>Functions</div>
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>LOC</th><th>Loops</th><th>Decisions</th><th>Cyclomatic</th><th>Recursion</th></tr>
                  </thead>
                  <tbody>
                    {result.functions.map((f,i)=>(
                      <tr key={i}>
                        <td>{f.name}</td>
                        <td>{f.loc?.start}-{f.loc?.end}</td>
                        <td>{f.loops}</td>
                        <td>{f.decisions}</td>
                        <td>{f.cyclomatic}</td>
                        <td>{f.selfRecursive ? "yes" : "no"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{marginTop:12}} className="small">No results yet</div>
          )}
        </div>

        <div className="card">
          <div style={{fontWeight:600}}>How it works</div>
          <div className="small" style={{marginTop:8}}>
            Parses the C++ AST using Tree-sitter (WebAssembly) and walks the tree to count loops, conditionals and function calls.
            Time complexity is heuristically derived from loop nesting + recursion. Java/Python use regex fallbacks in this starter.
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ title, value }){
  return (
    <div style={{padding:8, borderRadius:8, border:"1px solid #eef2f7"}}>
      <div style={{fontSize:12, color:"#6b7280"}}>{title}</div>
      <div style={{fontWeight:700, marginTop:6}}>{String(value)}</div>
    </div>
  );
}

/* ------------ Analyzer helpers -------------- */

function analyzeFallback(lang, code){
  // very small heuristics for java/python
  const loopRegex = /\b(for|while|foreach|for_each|range_for)\b/gi;
  const ifRegex = /\bif\b|\bswitch\b|\belse if\b/gi;
  const allocRegex = /\bnew\b|\bArrayList\b|\bvector<|\bList</gi;
  const loopCount = (code.match(loopRegex)||[]).length;
  const decisions = (code.match(ifRegex)||[]).length + (code.match(/&&|\|\|/g)||[]).length;
  const allocs = (code.match(allocRegex)||[]).length;
  const summary = {
    time: loopCount >= 2 ? (loopCount === 2 ? "O(N^2)" : `O(N^${loopCount})`) : (loopCount === 1 ? "O(N)" : "O(1) to O(N)"),
    space: allocs ? "O(N) (allocations detected)" : "O(1)",
    maxLoopDepth: loopCount,
    recursionCount: 0,
    totalDecisions: decisions,
    totalLoops: loopCount
  };
  const functions = []; // not attempting to extract real function list in fallback
  const hotspots = [];
  return { summary, functions, hotspots };
}

function analyzeCppTree(tree, code) {
  const root = tree.rootNode;
  let totalLoops = 0;
  let totalDecisions = 0;
  let maxLoopDepth = 0;
  const functions = [];
  const hotspots = [];

  function isTestCaseLoop(node){
  // crude detection: check while loop with condition like 't--' or 'testcases--'
  if(node.type === 'while_statement'){
    const cond = node.childForFieldName('condition');
    if(cond && /\b(t|testcases|tests)--/.test(cond.text)){
      return true;
    }
  }
  return false;
}

  function walk(node, context){
    context = context || { loopDepth:0, currentFunction:null };

    if(isTestCaseLoop(node)){
      // Do NOT increase loop depth for test-case input loop
      // Just walk its children with the same context
      for(let i=0; i<node.namedChildCount; i++){
        walk(node.namedChildren[i], context);
      }
      return;
    }

    const type = node.type;
    if (
      type === 'for_statement' ||
      type === 'while_statement' ||
      type === 'do_statement' ||
      type === 'range_based_for_statement'
    ) {
      context.loopDepth++;
      maxLoopDepth = Math.max(maxLoopDepth, context.loopDepth);
      totalLoops++;

      // Walk children with increased depth context
      for(let i=0; i<node.namedChildCount; i++){
        walk(node.namedChildren[i], context);
      }
      context.loopDepth--;
      return;
    }

    if(type === 'if_statement' || type === 'switch_statement' || type === 'conditional_expression') {
      totalDecisions++;
      if(context.currentFunction) context.currentFunction.decisions++;
    }

    if(type === 'function_definition' || type === 'function_declarator') {
      const nameNode = node.namedChildren.find(n=>n.type === 'identifier' || n.type === 'field_identifier');
      const fname = nameNode ? nameNode.text : `anon@${node.startPosition.row+1}`;
      const fn = { name: fname, loc: {start: node.startPosition.row+1, end: node.endPosition.row+1}, loops:0, decisions:0, cyclomatic:1, calls:[], selfRecursive:false };
      functions.push(fn);
      // reset loop depth to 0 for each function
      node.namedChildren.forEach(child => walk(child, {loopDepth:0, currentFunction:fn}));
      fn.cyclomatic = 1 + fn.decisions;
      const score = fn.loops*3 + fn.decisions*2 + (fn.selfRecursive ? 5 : 0) + Math.max(0, fn.cyclomatic-5);
      hotspots.push({ name: fn.name, score, at: `L${fn.loc.start}`, snippet: extractSnippet(code, fn.loc.start, fn.loc.end) });
      return;
    }

    if(type === 'call_expression'){
      const child = node.firstNamedChild;
      const name = child ? child.text : null;
      if(context.currentFunction && name){
        context.currentFunction.calls.push(name);
        if(name === context.currentFunction.name) context.currentFunction.selfRecursive = true;
      }
    }

    for(let i=0;i<node.namedChildCount;i++) {
      walk(node.namedChildren[i], context);
    }
  }

  walk(root, { loopDepth: 0, currentFunction: null });

  // Per-function refinement (optional, as before)
  functions.forEach(fn => {
    const bodyLines = code.split("\n").slice(fn.loc.start - 1, fn.loc.end).join("\n");
    fn.loops = (bodyLines.match(/\bfor\b|\bwhile\b/g) || []).length;
    fn.decisions = (bodyLines.match(/\bif\b|\bswitch\b|\?(?=\:)/g) || []).length;
    fn.cyclomatic = 1 + fn.decisions;
  });

  hotspots.sort((a, b) => b.score - a.score);

  // Improved time complexity formula: use actual max loop depth
  const time = maxLoopDepth === 0 ? "O(1) to O(N)" :
               (maxLoopDepth === 1 ? "O(N)" :
                 (maxLoopDepth === 2 ? "O(N^2)" : `O(N^${maxLoopDepth})`));
  const space = /\bnew\b|std::vector|std::map|malloc\b/.test(code) ? "O(N) (allocations detected)" : "O(1)";
  const summary = { time, space, maxLoopDepth, recursionCount: functions.filter(f => f.selfRecursive).length, totalDecisions, totalLoops };

  return { summary, functions, hotspots: hotspots.slice(0,8) };
}

function extractSnippet(code, startLine, endLine) {
  return code.split("\n").slice(startLine - 1, Math.min(endLine, startLine + 4)).join("\n");
}

