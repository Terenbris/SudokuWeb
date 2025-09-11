/* Solitaire Suite — Klondike • FreeCell • Pyramid
   MIT License. Single-file JS, no libs. Mobile-friendly tap controls. */

(() => {
  'use strict';

  /*** ---------- Utilities ---------- ***/
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const board = $('#board');
  const timeEl = $('#time'), movesEl = $('#moves'), msgEl = $('#message');
  const gameSelect = $('#gameSelect');
  const newBtn = $('#newBtn'), undoBtn = $('#undoBtn'), autoBtn = $('#autoBtn');
  const rulesBtn = $('#rulesBtn'), rulesDialog = $('#rulesDialog');
  const rulesTitle = $('#rulesTitle'), rulesContent = $('#rulesContent');

  const SUITS = ['♠','♥','♦','♣']; // order used for foundations
  const RED = new Set(['♥','♦']);
  const RANKS = [null,'A','2','3','4','5','6','7','8','9','10','J','Q','K'];

  const now = () => Date.now();
  const shuffle = (arr) => { for(let i=arr.length-1;i>0;i--){ const j = (Math.random()* (i+1))|0; [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; };
  const deepClone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

  function newDeck() {
    const deck = [];
    let id = 1;
    for (const s of SUITS) {
      for (let r = 1; r <= 13; r++) deck.push({ id: id++, r, s, up: false });
    }
    return deck;
  }

  const cardText = (c) => `${RANKS[c.r]}${c.s}`;
  const isRed = (c) => RED.has(c.s);
  const nextRank = (r) => r + 1;
  const prevRank = (r) => r - 1;

  const hms = (secs) => {
    const m = Math.floor(secs/60).toString().padStart(2,'0');
    const s = (secs%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  };

  /*** ---------- Engine shell ---------- ***/
  let current = null;          // active game object (see games below)
  let undoStack = [];          // stack of serialized states
  let moves = 0;               // move counter
  let startTs = 0;             // game start time
  let timerHandle = null;      // interval id
  let selected = null;         // selection {from: {type, idx?}, cards: [], meta: {...}}

  function resetStats(){
    moves = 0; movesEl.textContent = '0';
    startTs = now();
    timeEl.textContent = '00:00';
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(()=> {
      timeEl.textContent = hms(Math.floor((now() - startTs)/1000));
    }, 1000);
  }
  function pushUndo() { undoStack.push(current.serialize()); }
  function popUndo() {
    if (!undoStack.length) return;
    current.load(undoStack.pop()); moves = Math.max(0, moves-1);
    movesEl.textContent = moves.toString();
    selected = null; render(); say('Undid last move.');
  }
  function bumpMove(){
    moves++; movesEl.textContent = moves.toString();
  }
  function say(text){ msgEl.textContent = text || ''; }

  function switchGame(name){
    selected = null; undoStack = [];
    current = games[name]; current.newGame();
    rulesBtn.dataset.game = name;
    autoBtn.style.display = (name === 'klondike' || name === 'freecell') ? '' : 'none';
    resetStats();
    render();
    say(`New ${current.title} deal.`);
  }

  /*** ---------- Rendering helpers ---------- ***/
  function makePileEl({id, label, classes=[], tall=false, placeholder=null}){
    const el = document.createElement('div');
    el.className = `pile${tall?' hstack':''} ${classes.join(' ')}`.trim();
    el.dataset.pid = id;
    if (label){ const t = document.createElement('div'); t.className = 'pile-label'; t.textContent = label; el.appendChild(t); }
    if (placeholder){ const p = document.createElement('div'); p.className = 'placeholder'; p.textContent = placeholder; el.appendChild(p); }
    el.addEventListener('click', onPileTap);
    return el;
  }
  function makeCardEl(c, indexOffset=0){
    const el = document.createElement('div');
    el.className = `card ${c.up?'face-up':'face-down'} ${isRed(c)?'red':''}`.trim();
    el.dataset.cid = c.id;
    el.setAttribute('role','button');
    el.setAttribute('aria-label', `${RANKS[c.r]} of ${c.s === '♠' ? 'Spades' : c.s === '♥' ? 'Hearts' : c.s === '♦' ? 'Diamonds' : 'Clubs'}`);
    if (c.up){
      el.innerHTML = `
        <span class="tiny">${RANKS[c.r]}${c.s}</span>
        ${renderPip(c)}
        <span class="tiny br">${RANKS[c.r]}${c.s}</span>`;
      if (c.r === 13) el.classList.add('k');
    }
    el.style.top = `${indexOffset}px`;
    el.addEventListener('click', onCardTap);
    return el;
  }

  function renderPip(c){
    // Large center glyph — simple and performant (no SVG needed)
    return `<span aria-hidden="true">${RANKS[c.r]}${c.s}</span>`;
  }

  function clearBoard(){ board.innerHTML=''; }

  function render(){
    clearBoard(); current.render();
    // Selection highlight
    if (selected && selected.cards){
      const ids = new Set(selected.cards.map(c=>c.id));
      $$('.card.face-up', board).forEach(el => {
        if (ids.has(+el.dataset.cid)) el.classList.add('selected');
      });
    }
  }

  /*** ---------- Interaction (tap/click) ---------- ***/
  function onCardTap(e){
    const cid = +e.currentTarget.dataset.cid;
    const info = current.locate(cid);
    if (!info) return;

    if (!selected){
      const sel = current.selectFrom(info);
      if (sel && sel.cards.length){
        selected = sel; render(); // to show highlight
        say(sel.hint || 'Selected.');
      } else {
        say(sel?.hint || 'Cannot select that card.');
      }
      return;
    }

    // If the same pile/card was already selected, deselect.
    if (selected.cards.find(c => c.id === cid)){
      selected = null; render(); say('');
      return;
    }

    // Try to move onto this card's pile (card target)
    const moved = current.tryMove(selected, {type: info.type, index: info.index, pid: info.pid, ontoCard: info.card});
    if (moved){
      pushUndo(); bumpMove(); selected = null; render(); current.afterMove();
    } else {
      // maybe switch selection to another group
      const sel = current.selectFrom(info);
      if (sel && sel.cards.length){
        selected = sel; render(); say(sel.hint || 'Selected.');
      } else {
        say('Illegal move.');
      }
    }
  }

  function onPileTap(e){
    // empty target pile tap (or stock tap handled by game)
    const pid = e.currentTarget.dataset.pid;
    if (!pid) return;
    if (current.onPileTap && current.onPileTap(pid)){ // game handled (e.g., stock)
      pushUndo(); bumpMove(); render(); current.afterMove(); return;
    }
    if (!selected) return; // nothing selected to place

    const moved = current.tryMove(selected, {type: 'pile', pid});
    if (moved){
      pushUndo(); bumpMove(); selected = null; render(); current.afterMove();
    } else {
      say('Illegal move.');
    }
  }

  /*** ---------- Games ---------- ***/
  const games = {
    klondike: makeKlondike(),
    freecell: makeFreeCell(),
    pyramid: makePyramid(),
  };

  /*** ---------- Klondike ---------- ***/
  function makeKlondike(){
    // State: { stock:[], waste:[], tab:[[],...7], fnd:[[],[],[],[]] }
    let st = null;
    function deal(){
      const deck = shuffle(newDeck());
      const tab = Array.from({length:7},()=>[]);
      let i=0;
      for (let col=0; col<7; col++){
        for (let r=0; r<=col; r++){
          const c = deck[i++]; c.up = (r===col); tab[col].push(c);
        }
      }
      st = {
        stock: deck.slice(i),
        waste: [],
        tab,
        fnd: Array.from({length:4},()=>[]),
      };
    }

    function selectFrom(info){
      const {type, index, pid, card} = info;
      // from waste: only top card
      if (type==='waste'){
        if (st.waste.length && st.waste[st.waste.length-1].id === card.id){
          return {from:{type}, cards:[card], hint:'Waste selected'};
        }
        return {from:{type}, cards:[], hint:'Only top waste card can be moved'};
      }
      if (type==='foundation'){
        return {from:{type}, cards:[], hint:'Foundations are destination only'};
      }
      if (type==='stock'){
        return {from:{type}, cards:[], hint:'Tap stock to deal/recycle'};
      }
      if (type==='tableau'){
        // can select any face-up card + all below it (sequence can be arbitrary; legality checked on drop)
        const pile = st.tab[pid];
        const idx = pile.findIndex(c=>c.id===card.id);
        if (idx<0 || !pile[idx].up) return {from:{type}, cards:[], hint:'Only face-up cards'};
        const cards = pile.slice(idx);
        // Helpful validation: ensure selected sequence is alternating colors descending
        if (!isDescendingAlt(cards)) return {from:{type}, cards:[], hint:'Select a descending alternating sequence'};
        return {from:{type, idx:pid}, cards};
      }
      return null;
    }

    function tryMove(sel, target){
      // to foundation?
      if (target.type==='foundation' || (target.type==='pile' && target.pid.startsWith('f'))){
        const fi = Number((target.pid||'f0').replace(/[^\d]/g,''))|0;
        if (sel.cards.length!==1) return false;
        const c = sel.cards[0];
        const f = st.fnd[fi];
        const ok = (f.length===0 && c.r===1) || (f.length>0 && f[f.length-1].s===c.s && f[f.length-1].r+1===c.r);
        if (!ok) return false;
        removeFromSource(sel);
        st.fnd[fi].push({...c, up:true});
        return true;
      }

      // to tableau?
      if (target.type==='tableau' || (target.type==='pile' && target.pid.startsWith('t')) || target.type==='pile'){
        const ti = Number((target.pid||'t0').replace(/[^\d]/g,''))|0;
        const targetPile = st.tab[ti];
        const head = sel.cards[0];
        const top = targetPile[targetPile.length-1];
        const ok = (targetPile.length===0 && head.r===13) ||
                   (targetPile.length>0 && top.up && isRed(top)!==isRed(head) && top.r===head.r+1);
        if (!ok) return false;
        removeFromSource(sel);
        sel.cards.forEach(c=>targetPile.push(c)); // already face-up
        return true;
      }

      // onto a card in tableau/foundation (normalize to that pile)
      if (target.ontoCard){
        if (target.type==='tableau'){
          target = {type:'tableau', pid:target.pid};
          return tryMove(sel, target);
        }
        if (target.type==='foundation'){
          target = {type:'foundation', pid:`f${target.pid}`};
          return tryMove(sel, target);
        }
      }
      return false;
    }

    function isDescendingAlt(cards){
      for (let i=0;i<cards.length-1;i++){
        if (!cards[i].up || !cards[i+1].up) return false;
        if (isRed(cards[i])===isRed(cards[i+1])) return false;
        if (cards[i].r !== cards[i+1].r+1) return false;
      }
      return true;
    }

    function removeFromSource(sel){
      const src = sel.from.type;
      if (src==='waste'){ st.waste.pop(); return; }
      if (src==='tableau'){
        const i = sel.from.idx; st.tab[i].splice(st.tab[i].length - sel.cards.length);
        const top = st.tab[i][st.tab[i].length-1]; if (top && !top.up){ top.up = true; }
        return;
      }
    }

    function onPileTap(pid){
      // stock handling
      if (pid==='stock'){
        if (st.stock.length){
          const c = st.stock.pop(); c.up = true; st.waste.push(c);
          say('Dealt one card.');
        } else {
          if (!st.waste.length){ say('Stock empty.'); return false; }
          // recycle waste -> stock (face-down)
          while(st.waste.length){ const c = st.waste.pop(); c.up=false; st.stock.push(c); }
          say('Recycled waste back to stock.');
        }
        return true;
      }
      return false;
    }

    function autoMove(){
      // move any eligible single top card to its foundation; repeat greedily
      let moved = false, loopGuard = 0;
      do{
        loopGuard++; if (loopGuard>200) break;
        moved = false;
        // waste
        const wTop = st.waste[st.waste.length-1];
        if (wTop && canToFoundation(wTop)){ pushUndo(); placeToFoundation(wTop); st.waste.pop(); bumpMove(); moved = true; continue; }
        // tableaus
        for (let i=0;i<7;i++){
          const pile = st.tab[i]; const c = pile[pile.length-1];
          if (c && c.up && canToFoundation(c)){ pushUndo(); placeToFoundation(c); pile.pop(); const t= pile[pile.length-1]; if(t && !t.up) t.up=true; bumpMove(); moved = true; break; }
        }
      } while(moved);
      render(); afterMove();
    }
    function canToFoundation(c){
      const idx = SUITS.indexOf(c.s);
      const f = st.fnd[idx];
      return (f.length===0 && c.r===1) || (f.length && f[f.length-1].r+1===c.r);
    }
    function placeToFoundation(c){
      const fi = SUITS.indexOf(c.s);
      st.fnd[fi].push({...c, up:true});
    }

    function afterMove(){ // win check
      const totalF = st.fnd.reduce((a,p)=>a+p.length,0);
      if (totalF===52){ say('🎉 Klondike: You win!'); }
    }

    function locate(cid){
      // waste
      const w = st.waste.find(c=>c.id===cid); if (w) return {type:'waste', card:w, pid:'waste'};
      // stock (not selectable)
      // foundations
      for (let i=0;i<4;i++){ const c = st.fnd[i].find(x=>x.id===cid); if (c) return {type:'foundation', card:c, pid:i}; }
      // tableaus
      for (let i=0;i<7;i++){ const c = st.tab[i].find(x=>x.id===cid); if (c) return {type:'tableau', card:c, pid:i}; }
      return null;
    }

    function renderUI(){
      // Top row: stock, waste, spacer, 4 foundations
      const top = document.createElement('div'); top.className='section';
      const stock = makePileEl({id:'stock', label:'Stock', classes:['stock']});
      const waste = makePileEl({id:'waste', label:'Waste', classes:['waste']});
      const spacer = document.createElement('div'); spacer.style.flex='1';
      const fwrap = document.createElement('div'); fwrap.className='section'; fwrap.style.justifyContent='flex-end'; fwrap.style.flex='1';

      top.append(stock, waste, spacer, fwrap);
      board.appendChild(top);

      // foundations
      for (let i=0;i<4;i++){
        const f = makePileEl({id:`f${i}`, label:'Foundation', classes:['foundation'], placeholder:SUITS[i]});
        fwrap.appendChild(f);
        const pile = st.fnd[i];
        pile.forEach((c, idx) => {
          const el = makeCardEl(c); el.style.top='0px'; f.appendChild(el);
        });
      }

      // stock
      if (st.stock.length){
        const c = st.stock[st.stock.length-1];
        const el = makeCardEl({...c, up:false});
        stock.appendChild(el);
      }
      // waste
      if (st.waste.length){
        const c = st.waste[st.waste.length-1];
        const el = makeCardEl(c); waste.appendChild(el);
      }

      // Tableaus
      const row = document.createElement('div'); row.className='section';
      for (let i=0;i<7;i++){
        const t = makePileEl({id:`t${i}`, label:'', classes:['tableau'], tall:true, placeholder:'K'});
        row.appendChild(t);
        const pile = st.tab[i];
        pile.forEach((c, j)=>{
          const el = makeCardEl(c, j*getStack());
          t.appendChild(el);
        });
      }
      board.appendChild(row);
    }

    function getStack(){ return Math.max(10, Math.min(28, parseInt(getComputedStyle(document.documentElement).getPropertyValue('--stack')) || 18)); }

    return {
      key: 'klondike',
      title: 'Klondike',
      newGame(){ deal(); },
      render(){ renderUI(); },
      locate, selectFrom, tryMove,
      onPileTap, afterMove,
      auto: autoMove,
      serialize(){ return deepClone(st); },
      load(s){ st = deepClone(s); },
      rulesHtml: `
        <h3>Klondike</h3>
        <p>Build the four <em>foundations</em> from Ace to King by suit. Tableau builds down in alternating colors. Only a King (or King‑headed sequence) can move to an empty tableau.</p>
        <ul>
          <li><strong>Tap Stock</strong>: deal one card to Waste; when Stock is empty, tap to recycle Waste.</li>
          <li><strong>Tap a face‑up card</strong>: select that card and any properly ordered sequence below it.</li>
          <li><strong>Tap a target pile</strong> to attempt the move.</li>
          <li><strong>Auto</strong> moves obvious cards to foundations.</li>
        </ul>`
    };
  }

  /*** ---------- FreeCell ---------- ***/
  function makeFreeCell(){
    // State: { tab: [8 cols], free: [c|null]*4, fnd:[[],[],[],[]] } all face-up
    let st = null;

    function deal(){
      const deck = shuffle(newDeck()).map(c => ({...c, up:true}));
      const tab = Array.from({length:8},()=>[]);
      for (let i=0;i<deck.length;i++) tab[i%8].push(deck[i]);
      st = { tab, free:[null,null,null,null], fnd:Array.from({length:4},()=>[]) };
    }

    const isSeqDescAlt = (cards) => {
      for (let i=0;i<cards.length-1;i++){
        if (isRed(cards[i])===isRed(cards[i+1])) return false;
        if (cards[i].r !== cards[i+1].r+1) return false;
      }
      return true;
    };

    function selectFrom(info){
      const {type, pid, card} = info;
      if (type==='foundation') return {from:{type}, cards:[], hint:'Foundations are destination only'};
      if (type==='free'){
        // only the card itself
        const idx = Number(pid); const c = st.free[idx];
        if (c && c.id===card.id) return {from:{type, idx}, cards:[c], hint:'Free cell selected'};
        return {from:{type}, cards:[], hint:'Cell empty'};
      }
      if (type==='tableau'){
        const col = st.tab[pid];
        const idx = col.findIndex(c => c.id===card.id);
        if (idx<0) return {from:{type}, cards:[]};
        const selection = col.slice(idx);
        if (!isSeqDescAlt(selection)) return {from:{type}, cards:[], hint:'Select a descending alternating sequence'};
        // capacity check occurs when dropping
        return {from:{type, idx:pid}, cards: selection, hint:'Selected sequence'};
      }
      return null;
    }

    function maxMovable(toColIndex){
      const emptyFree = st.free.filter(x=>!x).length;
      const emptyCols = st.tab.reduce((n,col,i) => n + (col.length===0 && i!==toColIndex ? 1:0), 0);
      // Standard bound: (emptyFree + 1) * 2^emptyCols
      return (emptyFree + 1) * Math.pow(2, emptyCols);
    }

    function tryMove(sel, target){
      // to foundation?
      if (target.type==='foundation' || (target.type==='pile' && String(target.pid).startsWith('f'))){
        if (sel.cards.length!==1) return false;
        const c = sel.cards[0];
        const fi = SUITS.indexOf(c.s);
        const f = st.fnd[fi];
        const ok = (f.length===0 && c.r===1) || (f.length>0 && f[f.length-1].r+1===c.r);
        if (!ok) return false;
        removeFromSource(sel);
        st.fnd[fi].push(c);
        return true;
      }

      // to free cell?
      if (target.type==='free' || (target.type==='pile' && String(target.pid).startsWith('free'))){
        if (sel.cards.length!==1) return false;
        const idx = Number((target.pid||'free0').replace(/[^\d]/g,''))|0;
        if (st.free[idx]) return false;
        removeFromSource(sel);
        st.free[idx] = sel.cards[0];
        return true;
      }

      // to tableau?
      if (target.type==='tableau' || (target.type==='pile' && String(target.pid).startsWith('t'))){
        const ti = Number((target.pid||'t0').replace(/[^\d]/g,''))|0;
        const tcol = st.tab[ti];
        const head = sel.cards[0];
        const top = tcol[tcol.length-1];
        // check sequence legality
        if (tcol.length===0){
          // any sequence may be moved to empty column, but capacity applies
          if (sel.cards.length > maxMovable(ti)) return false;
        } else {
          if (!top || isRed(top)===isRed(head) || top.r !== head.r+1) return false;
          if (sel.cards.length > maxMovable(ti)) return false;
        }
        removeFromSource(sel);
        sel.cards.forEach(c => tcol.push(c));
        return true;
      }

      // onto a card? normalize to its pile
      if (target.ontoCard){
        if (target.type==='tableau'){
          target = {type:'tableau', pid:target.pid};
          return tryMove(sel, target);
        }
        if (target.type==='foundation'){
          target = {type:'foundation', pid:`f${target.pid}`};
          return tryMove(sel, target);
        }
        if (target.type==='free'){
          target = {type:'free', pid:`free${target.pid}`};
          return tryMove(sel, target);
        }
      }
      return false;
    }

    function removeFromSource(sel){
      const src = sel.from.type;
      if (src==='tableau'){
        const i = sel.from.idx;
        st.tab[i].splice(st.tab[i].length - sel.cards.length);
        return;
      }
      if (src==='free'){
        st.free[sel.from.idx] = null; return;
      }
    }

    function autoMove(){
      // Greedy: move any safe card to foundations
      let moved = false, guard = 0;
      do{
        guard++; if (guard>300) break;
        moved = false;
        // free cells
        for (let i=0;i<4;i++){
          const c = st.free[i];
          if (c && canToFoundation(c)){ pushUndo(); st.free[i]=null; placeToFoundation(c); bumpMove(); moved = true; }
        }
        if (moved) continue;
        // tableaus tops
        for (let i=0;i<8;i++){
          const col = st.tab[i]; const c = col[col.length-1];
          if (c && canToFoundation(c)){ pushUndo(); col.pop(); placeToFoundation(c); bumpMove(); moved = true; break; }
        }
      } while(moved);
      render(); afterMove();
    }
    const canToFoundation = (c) => {
      const fi = SUITS.indexOf(c.s), f = st.fnd[fi];
      return (f.length===0 && c.r===1) || (f.length && f[f.length-1].r+1===c.r);
    };
    const placeToFoundation = (c) => st.fnd[SUITS.indexOf(c.s)].push(c);

    function afterMove(){
      const totalF = st.fnd.reduce((a,p)=>a+p.length,0);
      if (totalF===52) say('🎉 FreeCell: You win!');
    }

    function locate(cid){
      // free
      for (let i=0;i<4;i++){ const c = st.free[i]; if (c && c.id===cid) return {type:'free', card:c, pid:i}; }
      // foundations
      for (let i=0;i<4;i++){ const c = st.fnd[i].find(x=>x.id===cid); if (c) return {type:'foundation', card:c, pid:i}; }
      // tableaus
      for (let i=0;i<8;i++){ const c = st.tab[i].find(x=>x.id===cid); if (c) return {type:'tableau', card:c, pid:i}; }
      return null;
    }

    function renderUI(){
      // Top: 4 free cells | spacer | 4 foundations
      const top = document.createElement('div'); top.className='section';
      const freeWrap = document.createElement('div'); freeWrap.className='section';
      freeWrap.style.flex='1';
      const fndWrap = document.createElement('div'); fndWrap.className='section';
      fndWrap.style.justifyContent='flex-end'; fndWrap.style.flex='1';
      top.append(freeWrap, fndWrap); board.appendChild(top);

      for (let i=0;i<4;i++){
        const ccell = makePileEl({id:`free${i}`, label:'Free', classes:['free'], placeholder:'•'});
        freeWrap.appendChild(ccell);
        const c = st.free[i];
        if (c){ const el = makeCardEl(c); el.style.top='0px'; ccell.appendChild(el); }
      }
      for (let i=0;i<4;i++){
        const f = makePileEl({id:`f${i}`, label:'Foundation', classes:['foundation'], placeholder:SUITS[i]});
        fndWrap.appendChild(f);
        const pile = st.fnd[i];
        if (pile.length){
          const el = makeCardEl(pile[pile.length-1]); el.style.top='0px'; f.appendChild(el);
        }
      }
      // Bottom: 8 tableaus
      const row = document.createElement('div'); row.className='section';
      for (let i=0;i<8;i++){
        const t = makePileEl({id:`t${i}`, classes:['tableau'], tall:true, placeholder:'Any'});
        row.appendChild(t);
        const col = st.tab[i];
        col.forEach((c, j) => {
          const el = makeCardEl(c, j*getStack()); t.appendChild(el);
        });
      }
      board.appendChild(row);
    }

    function getStack(){ return Math.max(12, Math.min(30, parseInt(getComputedStyle(document.documentElement).getPropertyValue('--stack')) || 18)); }

    return {
      key: 'freecell', title:'FreeCell',
      newGame(){ deal(); }, render(){ renderUI(); },
      locate, selectFrom, tryMove, afterMove,
      serialize(){ return deepClone(st); }, load(s){ st = deepClone(s); },
      auto: autoMove,
      rulesHtml: `
        <h3>FreeCell</h3>
        <p>All cards are face up. Build foundations from Ace to King by suit. Tableau builds down in alternating colors. Use the four Free Cells to temporarily store a single card each.</p>
        <ul>
          <li>Move sequences if they are strictly descending and alternating colors.</li>
          <li>Maximum sequence length depends on free cells and empty columns: <code>(free + 1) × 2<sup>emptyCols</sup></code>.</li>
          <li><strong>Auto</strong> moves obvious cards to foundations.</li>
        </ul>`
    };
  }

  /*** ---------- Pyramid ---------- ***/
  function makePyramid(){
    // State: { pyramid:[row0..row6], stock:[], waste:[], removed:Set, pairs:[] }
    let st = null;

    function deal(){
      const deck = shuffle(newDeck()).map(c => ({...c, up:true}));
      const pyr = [];
      let i=0;
      for (let r=0;r<7;r++){
        const row = [];
        for (let k=0;k<=r;k++) row.push({...deck[i++]});
        pyr.push(row);
      }
      st = { pyramid: pyr, stock: deck.slice(i), waste: [], removed: new Set(), pairs: [] };
    }

    function isExposed(pos){ // {r,c}
      const {r,c} = pos;
      if (r===6) return !st.removed.has(key(r,c));
      if (st.removed.has(key(r,c))) return false;
      const coveredLeft = !st.removed.has(key(r+1, c));
      const coveredRight = !st.removed.has(key(r+1, c+1));
      return !(coveredLeft || coveredRight);
    }
    const key = (r,c) => `${r},${c}`;

    function locate(cid){
      // waste top
      if (st.waste.length && st.waste[st.waste.length-1].id===cid){
        return {type:'waste', card: st.waste.at(-1), pid:'waste'};
      }
      // pyramid
      for (let r=0;r<7;r++){
        for (let c=0;c<st.pyramid[r].length;c++){
          const card = st.pyramid[r][c];
          if (card && card.id===cid){
            return {type:'pyramid', card, pid:`pyr-${r}-${c}`, index:{r,c}};
          }
        }
      }
      // stock not selectable
      return null;
    }

    function selectFrom(info){
      if (info.type==='waste'){
        if (!st.waste.length) return {from:{type:'waste'}, cards:[], hint:'Waste is empty'};
        return {from:{type:'waste'}, cards:[st.waste.at(-1)], hint:'Waste selected'};
      }
      if (info.type==='pyramid'){
        const {r,c} = info.index;
        if (!isExposed({r,c})) return {from:{type:'pyramid'}, cards:[], hint:'Card is covered'};
        const card = st.pyramid[r][c];
        return {from:{type:'pyramid', index:{r,c}}, cards:[card], hint:'Pyramid card selected'};
      }
      return null;
    }

    function tryMove(sel, target){
      // Pyramid pairs to 13. Kings remove solo.
      const a = sel.cards[0]; if (!a) return false;
      if (a.r === 13){
        // remove king immediately if from pyramid or waste and (for pyramid) it is exposed
        if (sel.from.type==='pyramid'){
          const {r,c} = sel.from.index; if (!isExposed({r,c})) return false;
          st.removed.add(key(r,c)); st.pairs.push([a]); return true;
        }
        if (sel.from.type==='waste'){ st.waste.pop(); st.pairs.push([a]); return true; }
        return false;
      }

      // If target is another exposed pyramid card or waste top
      if (target.ontoCard){
        const b = target.ontoCard;
        // only allow pairing with top waste or an exposed pyramid card that is different from a
        if (sel.from.type==='pyramid' && target.type==='pyramid'){
          const {r,c} = target.index;
          if (!isExposed({r,c})) return false;
          if (a.id===b.id) return false;
          if (a.r + b.r === 13){
            // remove both
            const {r:ra,c:ca} = sel.from.index;
            st.removed.add(key(ra,ca));
            st.removed.add(key(r,c));
            st.pairs.push([a,b]);
            return true;
          }
          return false;
        }
        if (target.type==='waste'){
          if (st.waste.length && st.waste.at(-1).id===b.id && a.r + b.r === 13){
            // remove a (if pyramid) and pop waste
            if (sel.from.type==='pyramid'){
              const {r,c} = sel.from.index; st.removed.add(key(r,c));
            } else if (sel.from.type==='waste'){
              // already on waste; need a second card from pyramid (handled above)
              return false;
            }
            st.waste.pop();
            st.pairs.push([a,b]);
            return true;
          }
          return false;
        }
      }

      // Tap on empty pile areas?
      if (target.type==='pile'){
        // stock tap handled in onPileTap
        return false;
      }
      return false;
    }

    function onPileTap(pid){
      if (pid==='stock'){
        if (st.stock.length){
          st.waste.push(st.stock.pop());
          say('Dealt one to waste.');
        } else {
          if (!st.waste.length){ say('Stock empty.'); return false; }
          // recycle waste -> stock
          while(st.waste.length){ st.stock.push(st.waste.pop()); }
          say('Recycled waste.');
        }
        return true;
      }
      return false;
    }

    function afterMove(){
      // win if all 28 pyramid cards are removed
      let removedCount = 0;
      for (let r=0;r<7;r++) removedCount += st.pyramid[r].filter((_,c)=>st.removed.has(key(r,c))).length;
      if (removedCount===28) say('🎉 Pyramid: You cleared the pyramid!');
    }

    function renderUI(){
      // Top: stock, waste, pairs area
      const top = document.createElement('div'); top.className='section';
      const stock = makePileEl({id:'stock', label:'Stock', classes:['stock'], placeholder:'⟳'});
      const waste = makePileEl({id:'waste', label:'Waste', classes:['waste']});
      const pairs = makePileEl({id:'pairs', label:'Pairs', classes:['pairs']});
      top.append(stock, waste, pairs);
      board.appendChild(top);

      // stock/waste render
      if (st.stock.length){
        const el = makeCardEl({...st.stock.at(-1), up:false}); el.classList.add('ghost'); stock.appendChild(el);
      }
      if (st.waste.length){
        const el = makeCardEl(st.waste.at(-1)); waste.appendChild(el);
      }
      if (st.pairs.length){
        const last = st.pairs.at(-1);
        // show last removed (for feedback)
        last.forEach((c,i)=>{ const el = makeCardEl(c); el.style.left = `${i*10}px`; el.style.top='0px'; pairs.appendChild(el); });
      }

      // Pyramid grid
      const pyrWrap = document.createElement('div'); pyrWrap.className='section wrap';
      const pyramid = document.createElement('div'); pyramid.className='pyramid';
      pyrWrap.appendChild(pyramid);
      board.appendChild(pyrWrap);

      for (let r=0;r<7;r++){
        const rowEl = document.createElement('div'); rowEl.className='pyr-row';
        for (let c=0;c<=r;c++){
          if (st.removed.has(key(r,c))) {
            const ph = makePileEl({id:`pyr-${r}-${c}`, classes:['pyr-hole'], placeholder:'×'});
            ph.style.visibility='hidden';
            rowEl.appendChild(ph);
            continue;
          }
          const card = st.pyramid[r][c];
          const el = makeCardEl(card); el.dataset.pid = `pyr-${r}-${c}`;
          if (!isExposed({r,c})) el.classList.add('ghost');
          rowEl.appendChild(el);
        }
        pyramid.appendChild(rowEl);
      }
    }

    return {
      key:'pyramid', title:'Pyramid',
      newGame(){ deal(); },
      render(){ renderUI(); },
      locate, selectFrom, tryMove, afterMove, onPileTap,
      serialize(){ return deepClone(st); }, load(s){ st = deepClone(s); },
      rulesHtml: `
        <h3>Pyramid</h3>
        <p>Remove cards that sum to 13. A King removes on its own. You may pair an <em>exposed</em> pyramid card with the top Waste card, or with another exposed pyramid card.</p>
        <ul>
          <li><strong>Exposed</strong> = no cards resting on it.</li>
          <li><strong>Stock</strong>: tap to deal one to Waste; when empty, tap to recycle Waste.</li>
          <li>Clear all 28 pyramid cards to win.</li>
        </ul>`
    };
  }

  /*** ---------- Wire up global UI ---------- ***/
  function openRules(){
    rulesTitle.textContent = `${current.title} — Rules`;
    rulesContent.innerHTML = current.rulesHtml;
    rulesDialog.showModal();
  }

  gameSelect.addEventListener('change', e => switchGame(e.target.value));
  newBtn.addEventListener('click', () => switchGame(gameSelect.value));
  undoBtn.addEventListener('click', () => popUndo());
  autoBtn.addEventListener('click', () => current.auto && current.auto());
  rulesBtn.addEventListener('click', openRules);

  // Keyboard convenience (optional)
  window.addEventListener('keydown', (e)=>{
    if (e.key==='z' && (e.ctrlKey||e.metaKey)) { e.preventDefault(); popUndo(); }
    if (e.key==='n' && (e.ctrlKey||e.metaKey)) { e.preventDefault(); switchGame(gameSelect.value); }
    if (e.key==='a' && (e.ctrlKey||e.metaKey)) { e.preventDefault(); current.auto && current.auto(); }
    if (e.key==='?') { e.preventDefault(); openRules(); }
  });

  // Initial boot
  switchGame('klondike');
})();
