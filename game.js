/* SPADES GAME ENGINE
   Mode 6 = Spade Trump (custom 6-player / 3v3)
   Mode 4 = Classic Spades (standard 4-player / 2v2)
   Mode 2 = Spade Duel (head-to-head)
*/
(() => {
  'use strict';
  const qs=new URLSearchParams(location.search);
  const mode=['6','4','2'].includes(qs.get('mode'))?qs.get('mode'):'6';
  const cfg={
    '6':{name:'SPADE TRUMP',subtitle:'6 Players • 3 vs 3',players:6,cards:9,tricks:9,rounds:6,teamNames:['BLUE TEAM','RED TEAM']},
    '4':{name:'CLASSIC SPADES',subtitle:'4 Players • 2 vs 2',players:4,cards:13,tricks:13,rounds:1,teamNames:['TEAM A','TEAM B']},
    '2':{name:'SPADE DUEL',subtitle:'2 Players • Head to Head',players:2,cards:26,tricks:26,rounds:1,teamNames:['YOU','OPPONENT']}
  }[mode];
  const SUITS=['♠','♥','♦','♣'];
  const ORDER={'♠':0,'♥':1,'♦':2,'♣':3};
  const RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const VALUE=Object.fromEntries(RANKS.map((r,i)=>[r,i+2]));
  const $=id=>document.getElementById(id);
  const tg=window.Telegram&&window.Telegram.WebApp?window.Telegram.WebApp:null;
  if(tg){try{tg.ready();tg.expand()}catch(e){}}
  let players=[],deck=[],currentPlayer=0,currentTrick=[],trickNo=0,roundNo=1,scoreA=0,scoreB=0,bagsA=0,bagsB=0,blueTricks=0,redTricks=0,started=false,resolving=false,gameOver=false,selectedIndex=-1,playTimer;
  function makeDeck(){const d=[];for(const suit of SUITS)for(const rank of RANKS)d.push({suit,rank,value:VALUE[rank],id:rank+suit});if(mode==='6'){d.push({suit:'🃏',rank:'RJ',value:15,id:'RJ',joker:'red'});d.push({suit:'🃏',rank:'BJ',value:13,id:'BJ',joker:'black'});}return d}
  function shuffle(a){for(let i=a.length-1;i>0;i--){let r;if(window.crypto&&crypto.getRandomValues){const x=new Uint32Array(1);crypto.getRandomValues(x);r=x[0]/4294967296}else r=Math.random();const j=Math.floor(r*(i+1));[a[i],a[j]]=[a[j],a[i]]}}
  function createPlayers(){players=Array.from({length:cfg.players},(_,i)=>({id:i,name:i===0?'YOU':mode==='2'?'OPPONENT':`PLAYER ${i+1}`,team:mode==='2'?i:(i%2===0?0:1),hand:[],bid:null,tricks:0,nil:false}))}
  function deal(){deck=makeDeck();shuffle(deck);players.forEach(p=>{p.hand=[];p.tricks=0;p.bid=null;p.nil=false});for(let i=0;i<cfg.players*cfg.cards;i++)players[i%cfg.players].hand.push(deck[i]);players.forEach(p=>p.hand.sort((a,b)=>ORDER[a.suit]-ORDER[b.suit]||b.value-a.value))}
  function teamOf(i){return players[i].team===0?0:1}function teamPlayers(t){return players.filter(p=>p.team===t)}function teamBid(t){return teamPlayers(t).reduce((n,p)=>n+(p.bid||0),0)}function teamTricks(t){return teamPlayers(t).reduce((n,p)=>n+p.tricks,0)}function isJoker(c){return!!c.joker}
  function legalCard(p,c){if(!currentTrick.length){if(mode==='6'&&isJoker(c)&&p.hand.some(x=>!isJoker(x)))return false;return true}const lead=currentTrick[0].card.suit;if(isJoker(c))return mode==='6';if(lead==='🃏')return true;const hasLead=p.hand.some(x=>x.suit===lead);return !hasLead||c.suit===lead}
  function strength(c,lead){if(mode==='6'){if(c.joker==='red')return 100;if(c.suit==='♠'&&c.rank==='A')return 99;if(c.joker==='black')return 98;if(c.suit==='♠')return 50+c.value;if(c.suit===lead)return c.value;return -1}if(c.suit==='♠')return 50+c.value;if(c.suit===lead)return c.value;return -1}
  function beats(a,b,lead){return strength(a,lead)>strength(b,lead)}
  function renderConfig(){
    $('topGameName').textContent=cfg.name;$('topMode').textContent=cfg.subtitle;$('gameTitle').textContent=cfg.name;$('gameSubtitle').textContent=cfg.subtitle;$('roundValue').textContent=cfg.rounds>1?'1 / '+cfg.rounds:'MATCH';$('trickValue').textContent='0 / '+cfg.tricks;$('scoreAName').textContent=cfg.teamNames[0];$('scoreBName').textContent=cfg.teamNames[1];
    for(let i=0;i<6;i++)if($('seat'+i))$('seat'+i).style.display=i<cfg.players?'block':'none';
    if(mode==='4'){$('seat0').className='seat bottom you';$('seat1').className='seat left-top';$('seat2').className='seat top';$('seat3').className='seat right-top';$('hint').textContent='Tap a legal card to send it to the table.'}
    if(mode==='2'){$('seat0').className='seat bottom you';$('seat1').className='seat top';for(let i=2;i<6;i++)$('seat'+i).style.display='none';$('name1').textContent='OPPONENT';$('scoreAName').textContent='YOU';$('scoreBName').textContent='OPPONENT';$('roundValue').textContent='MATCH'}
    for(let i=0;i<cfg.players;i++){if($('name'+i))$('name'+i).textContent=players[i].name;if($('state'+i))$('state'+i).textContent='Waiting'}
  }
  function renderHand(){const box=$('hand');box.innerHTML='';const cards=players[0].hand;$('cardsLeft').textContent=cards.length+' CARDS';cards.forEach((c,i)=>{const b=document.createElement('button');b.type='button';b.className='card'+((c.suit==='♥'||c.suit==='♦')?' red':'')+(isJoker(c)?' joker':'');b.innerHTML='<span class="rank">'+c.rank+'</span><span class="suit">'+(c.joker?'🃏':c.suit)+'</span>';if(!(started&&currentPlayer===0&&!gameOver&&legalCard(players[0],c)))b.classList.add('disabled');b.onclick=()=>tapCard(i);box.appendChild(b)})}
  function tapCard(i){if(gameOver)return;if(!started){toast('Place your bid first.');return}if(currentPlayer!==0){toast('Wait for your turn.');return}const c=players[0].hand[i];if(!c)return;if(!legalCard(players[0],c)){toast('You must follow the leading suit.');return}selectedIndex=i;document.querySelectorAll('.card').forEach((el,n)=>el.classList.toggle('selected',n===i));clearTimeout(playTimer);playTimer=setTimeout(()=>playCard(0,i),120)}
  function playCard(pi,i){if(resolving)return;const p=players[pi],c=p&&p.hand[i];if(!c||pi!==currentPlayer)return;if(!legalCard(p,c))return;p.hand.splice(i,1);currentTrick.push({player:pi,card:c});addPlayed(c,pi,currentTrick.length-1);selectedIndex=-1;renderHand();updateSeats();log(p.name+' played '+(c.joker?c.rank:c.rank+c.suit)+'.');$('trickValue').textContent=(trickNo+1)+' / '+cfg.tricks;if(currentTrick.length===cfg.players){resolving=true;setTimeout(resolveTrick,700);return}currentPlayer=(currentPlayer+1)%cfg.players;updateSeats();if(currentPlayer!==0)setTimeout(botTurn,450)}
  function addPlayed(c,pi,pos){const d=document.createElement('div');d.className='played pcard-'+pos+((c.suit==='♥'||c.suit==='♦')?' red':'');d.innerHTML='<span class="owner">'+players[pi].name+'</span><span>'+c.rank+'</span><span>'+(c.joker?'🃏':c.suit)+'</span>';$('playArea').appendChild(d)}
  function botTurn(){if(gameOver||currentPlayer===0||resolving)return;const p=players[currentPlayer];if(!p||!p.hand.length)return;const choices=p.hand.map((c,i)=>({c,i})).filter(x=>legalCard(p,x.c));const list=choices.length?choices:p.hand.map((c,i)=>({c,i}));const lead=currentTrick.length?currentTrick[0].card.suit:null;let best=list[0];if(currentTrick.length){let w=currentTrick[0];for(const x of currentTrick)if(beats(x.card,w.card,lead))w=x;const wins=list.filter(x=>beats(x.c,w.card,lead));best=(wins.length?wins:list).sort((a,b)=>strength(a.c,lead||a.c.suit)-strength(b.c,lead||b.c.suit))[0]}else best=list.sort((a,b)=>strength(a.c,a.c.suit)-strength(b.c,b.c.suit))[0];playCard(currentPlayer,best.i)}
  function resolveTrick(){const lead=currentTrick[0].card.suit;let w=currentTrick[0];for(let i=1;i<currentTrick.length;i++)if(beats(currentTrick[i].card,w.card,lead))w=currentTrick[i];players[w.player].tricks++;if(teamOf(w.player)===0)blueTricks++;else redTricks++;log(players[w.player].name+' wins the trick.');toast(players[w.player].name+' wins');trickNo++;currentTrick=[];$('playArea').innerHTML='';$('trickValue').textContent=trickNo+' / '+cfg.tricks;resolving=false;if(trickNo>=cfg.tricks){finishRound();return}currentPlayer=w.player;updateSeats();if(currentPlayer!==0)setTimeout(botTurn,450)}
  function setupBids(){const g=$('bidGrid');g.innerHTML='';const max=mode==='6'?7:mode==='4'?13:26;for(let i=0;i<=max;i++){const b=document.createElement('button');b.type='button';b.className='bid';b.textContent=i;b.onclick=()=>chooseBid(i);g.appendChild(b)}}
  function openBid(){if(started||gameOver)return;$('bidModal').classList.add('show')}function closeBid(){$('bidModal').classList.remove('show')}
  function chooseBid(v){players[0].bid=v;players[0].nil=v===0;botBids();if(mode==='6'&&teamBid(0)<2){toast('Your team bid must be at least 2.');players[0].bid=null;return}started=true;currentPlayer=0;closeBid();$('bidButton').disabled=true;$('centerStatus').textContent='YOUR TURN';log('You bid '+v+'.');updateSeats();renderHand();log(mode==='6'?'Blue bid: '+teamBid(0)+' • Red bid: '+teamBid(1):'Your bid: '+v+' • Opponent bid: '+(players[1]?.bid??0))}
  function botBids(){players.slice(1).forEach(p=>{const sp=p.hand.filter(c=>c.suit==='♠').length;const hi=p.hand.filter(c=>c.suit==='♠'&&c.value>=12).length;let b=Math.min(mode==='6'?7:mode==='4'?13:26,Math.max(0,Math.round(sp*.45+hi*.8)));if(mode==='4'&&b===0&&p.hand.some(c=>c.suit==='♠'&&c.value>=13))b=1;if(mode==='2')b=Math.max(1,Math.round(sp*.7));p.bid=b;p.nil=b===0})}
  function finishRound(){if(mode==='6')scoreSix();else if(mode==='4')scoreClassic();else scoreDuel();renderScore();if(roundNo>=cfg.rounds||mode!=='6'){finishGame();return}setTimeout(nextRound,1200)}
  function scoreSix(){const a=teamBid(0),b=teamBid(1);scoreA+=blueTricks>=a?a*20+Math.max(0,blueTricks-a)*10:-a*20;scoreB+=redTricks>=b?b*20+Math.max(0,redTricks-b)*10:-b*20;log('Round '+roundNo+': Blue '+blueTricks+'/'+a+', Red '+redTricks+'/'+b+'.')}
  function scoreClassic(){for(const t of [0,1]){const bid=teamBid(t),tr=teamTricks(t),made=tr>=bid;let delta=made?bid*10+Math.max(0,tr-bid):-bid*10;for(const p of teamPlayers(t).filter(x=>x.nil))delta+=p.tricks===0?100:-100;if(t===0){scoreA+=delta;if(made)bagsA+=Math.max(0,tr-bid)}else{scoreB+=delta;if(made)bagsB+=Math.max(0,tr-bid)}}if(bagsA>=10){scoreA-=100;bagsA-=10}if(bagsB>=10){scoreB-=100;bagsB-=10}}
  function scoreDuel(){scoreA+=blueTricks;scoreB+=redTricks}
  function nextRound(){roundNo++;trickNo=0;blueTricks=0;redTricks=0;started=false;resolving=false;currentTrick=[];$('roundValue').textContent=roundNo+' / '+cfg.rounds;$('trickValue').textContent='0 / '+cfg.tricks;$('playArea').innerHTML='';deal();$('bidButton').disabled=false;players.forEach((p,i)=>{$('bid'+i)&&($('bid'+i).textContent='BID: —')});renderHand();updateSeats();log('Round '+roundNo+' started.')}
  function finishGame(){gameOver=true;started=false;$('bidButton').disabled=true;$('playButton').disabled=true;const w=scoreA===scoreB?'DRAW':scoreA>scoreB?cfg.teamNames[0]:cfg.teamNames[1];$('centerStatus').textContent=w==='DRAW'?'GAME DRAW':w+' WINS';$('hint').textContent='Game finished.';log(w==='DRAW'?'Game draw: '+scoreA+' - '+scoreB+'.':w+' wins: '+Math.max(scoreA,scoreB)+' - '+Math.min(scoreA,scoreB)+'.');toast(w==='DRAW'?'GAME DRAW':w+' WINS')}
  function renderScore(){$('scoreA').textContent=scoreA;$('scoreB').textContent=scoreB;$('bagsA').textContent=mode==='4'?'BAGS '+bagsA:'';$('bagsB').textContent=mode==='4'?'BAGS '+bagsB:''}
  function updateSeats(){for(let i=0;i<cfg.players;i++){const p=players[i];$('seat'+i).classList.toggle('active',i===currentPlayer&&!gameOver);$('state'+i).textContent=i===currentPlayer&&!gameOver?'PLAYING':'TRICKS: '+p.tricks;$('bid'+i).textContent='BID: '+(p.bid==null?'—':p.bid)}$('centerStatus').textContent=gameOver?'GAME FINISHED':!started?'Waiting for bid':currentPlayer===0?'YOUR TURN':players[currentPlayer].name+' IS PLAYING'}
  function log(t){const e=$('gameLog');const r=document.createElement('div');r.textContent='• '+t;e.appendChild(r);while(e.children.length>40)e.removeChild(e.firstChild);e.scrollTop=e.scrollHeight}
  let toastTimer;function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),1700)}
  window.goHome=()=>{const p=location.pathname;location.href=p.slice(0,p.lastIndexOf('/')+1)+'index.html'};
  $('bidButton').onclick=openBid;$('closeBid').onclick=closeBid;$('bidModal').onclick=e=>{if(e.target.id==='bidModal')closeBid()};$('playButton').onclick=()=>{if(selectedIndex>=0)playCard(0,selectedIndex)};
  function init(){createPlayers();renderConfig();setupBids();deal();renderHand();renderScore();updateSeats();$('connectionText').textContent='LOCAL';log(cfg.name+' ready • '+cfg.players+' players • '+cfg.cards+' cards each.');log(mode==='6'?'9 tricks per round • 6 rounds • custom 3v3 rules.':mode==='4'?'Classic Spades • 13 cards each • 13 tricks.':'Spade Duel • head to head.')}
  init();
})();
