/* =========================================================
   SPADES • 6 PLAYER
   FINAL OFFLINE GAME ENGINE
   ---------------------------------------------------------
   6 ROUNDS
   9 CARDS PER PLAYER
   STARTERS: P1 → P2 → P3 → P4 → P5 → P6
   TEAMS:
      BLUE = P1 + P3 + P5
      RED  = P2 + P4 + P6

   OFFLINE
   SMART TEAM AI
   CARD MEMORY
   TRICK MEMORY
========================================================= */

"use strict";


/* =========================================================
   CONFIG
========================================================= */

const TOTAL_ROUNDS = 6;
const CARDS_PER_PLAYER = 9;
const PLAYER_COUNT = 6;

const BLUE_TEAM = [1, 3, 5];
const RED_TEAM  = [2, 4, 6];

const STARTERS = [1, 2, 3, 4, 5, 6];

const MOVE_TIME = 10000;


/* =========================================================
   DOM HELPER
========================================================= */

const $ = id => document.getElementById(id);

function qs(selector){
    return document.querySelector(selector);
}

function qsa(selector){
    return [...document.querySelectorAll(selector)];
}


/* =========================================================
   GAME STATE
========================================================= */

const state = {

    started: false,

    phase: "lobby",

    round: 0,

    starter: 1,

    currentPlayer: 1,

    trickNumber: 0,

    turnIndex: 0,

    deck: [],

    hands: {},

    playedCards: [],

    trickCards: [],

    trickHistory: [],

    cardHistory: [],

    bids: {

        blue: 0,
        red: 0

    },

    tricks: {

        blue: 0,
        red: 0

    },

    score: {

        blue: 0,
        red: 0

    },

    roundScores: [],

    bidHistory: [],

    playerBids: {},

    knownCards: {},

    voidSuits: {},

    leadSuit: null,

    winner: null,

    moveTimer: null,

    aiThinking: false

};


/* =========================================================
   CARD DEFINITIONS
========================================================= */

const SUITS = [
    "♠",
    "♥",
    "♦",
    "♣"
];

const SUIT_NAMES = {
    "♠":"spades",
    "♥":"hearts",
    "♦":"diamonds",
    "♣":"clubs"
};

const RANKS = [
    {
        rank:"2",
        value:2
    },
    {
        rank:"3",
        value:3
    },
    {
        rank:"4",
        value:4
    },
    {
        rank:"5",
        value:5
    },
    {
        rank:"6",
        value:6
    },
    {
        rank:"7",
        value:7
    },
    {
        rank:"8",
        value:8
    },
    {
        rank:"9",
        value:9
    },
    {
        rank:"10",
        value:10
    },
    {
        rank:"J",
        value:11
    },
    {
        rank:"Q",
        value:12
    },
    {
        rank:"K",
        value:13
    },
    {
        rank:"A",
        value:14
    }
];


/* =========================================================
   CREATE DECK
========================================================= */

function createDeck(){

    const deck = [];

    let id = 0;

    for(const suit of SUITS){

        for(const rank of RANKS){

            deck.push({

                id: id++,

                suit,

                rank: rank.rank,

                value: rank.value,

                color:
                    suit === "♥" ||
                    suit === "♦"
                        ? "red"
                        : "black",

                joker:false

            });

        }

    }

    /*
       Jokers are included separately.
    */

    deck.push({

        id:id++,

        suit:"JOKER",

        rank:"RED",

        value:16,

        color:"red",

        joker:true

    });

    deck.push({

        id:id++,

        suit:"JOKER",

        rank:"BLACK",

        value:15,

        color:"black",

        joker:true

    });

    return deck;
}


/* =========================================================
   SHUFFLE
========================================================= */

function shuffle(array){

    for(
        let i=array.length-1;
        i>0;
        i--
    ){

        const j =
            Math.floor(
                Math.random() * (i+1)
            );

        [
            array[i],
            array[j]
        ] =
        [
            array[j],
            array[i]
        ];

    }

    return array;
}


/* =========================================================
   PLAYER HELPERS
========================================================= */

function isBlue(player){

    return BLUE_TEAM.includes(
        player
    );
}

function isRed(player){

    return RED_TEAM.includes(
        player
    );
}

function teamOf(player){

    return isBlue(player)
        ? "blue"
        : "red";
}

function teammates(player){

    return isBlue(player)
        ? BLUE_TEAM.filter(
            p => p !== player
        )
        : RED_TEAM.filter(
            p => p !== player
        );
}

function opponents(player){

    return isBlue(player)
        ? RED_TEAM
        : BLUE_TEAM;
}


/* =========================================================
   INITIALIZE MEMORY
========================================================= */

function resetMemory(){

    state.knownCards = {};

    state.voidSuits = {};

    state.cardHistory = [];

    state.trickHistory = [];

    for(let p=1;p<=6;p++){

        state.knownCards[p] = [];

        state.voidSuits[p] = {

            "♠":false,
            "♥":false,
            "♦":false,
            "♣":false

        };

    }

}


/* =========================================================
   RESET GAME
========================================================= */

function resetGame(){

    clearTimeout(
        state.moveTimer
    );

    state.started = false;

    state.phase = "lobby";

    state.round = 0;

    state.starter = 1;

    state.currentPlayer = 1;

    state.trickNumber = 0;

    state.turnIndex = 0;

    state.deck = [];

    state.hands = {};

    state.playedCards = [];

    state.trickCards = [];

    state.tricks.blue = 0;
    state.tricks.red = 0;

    state.score.blue = 0;
    state.score.red = 0;

    state.roundScores = [];

    state.bidHistory = [];

    state.playerBids = {};

    state.leadSuit = null;

    state.winner = null;

    resetMemory();

}


/* =========================================================
   START GAME
========================================================= */

function startGame(){

    if(state.started){

        return;

    }

    resetGame();

    state.started = true;

    state.phase = "dealing";

    state.round = 0;

    state.starter = 1;

    state.trickNumber = 0;

    updateTopUI();

    updateScoreUI();

    dealRound();

}


/* =========================================================
   DEAL ROUND
========================================================= */

function dealRound(){

    state.phase = "dealing";

    state.deck =
        shuffle(
            createDeck()
        );

    state.hands = {};

    for(let p=1;p<=6;p++){

        state.hands[p] = [];

    }

    /*
       54 cards exist because of 2 jokers.
       Only 54 cards are needed:
       6 players × 9 = 54.
    */

    for(let i=0;i<54;i++){

        const player =
            (i % PLAYER_COUNT) + 1;

        state.hands[player].push(
            state.deck[i]
        );

    }

    for(let p=1;p<=6;p++){

        sortHand(
            state.hands[p]
        );

    }

    resetRoundMemory();

    renderHands();

    updateTopUI();

    setTimeout(
        startBidding,
        450
    );

}


/* =========================================================
   SORT HAND
========================================================= */

function sortHand(hand){

    const suitOrder = {
        "♠":4,
        "♥":3,
        "♦":2,
        "♣":1,
        "JOKER":5
    };

    hand.sort(
        (a,b)=>{

            if(
                suitOrder[a.suit] !==
                suitOrder[b.suit]
            ){

                return (
                    suitOrder[b.suit] -
                    suitOrder[a.suit]
                );

            }

            return b.value-a.value;

        }
    );

}


/* =========================================================
   ROUND MEMORY
========================================================= */

function resetRoundMemory(){

    state.trickCards = [];

    state.leadSuit = null;

    state.trickNumber = 0;

    state.turnIndex = 0;

    state.currentPlayer =
        state.starter;

    state.playerBids = {};

    resetMemory();

}


/* =========================================================
   BIDDING
========================================================= */

function startBidding(){

    state.phase = "bidding";

    state.playerBids = {};

    /*
       Human player = P1.
       AI players calculate their own bids.
    */

    for(let p=2;p<=6;p++){

        state.playerBids[p] =
            calculateAIBid(p);

    }

    /*
       Human receives a balanced suggestion.
    */

    const suggested =
        calculateAIBid(1);

    state.playerBids[1] =
        suggested;

    state.bids.blue =
        BLUE_TEAM.reduce(
            (sum,p)=>
                sum +
                (state.playerBids[p] || 0),
            0
        );

    state.bids.red =
        RED_TEAM.reduce(
            (sum,p)=>
                sum +
                (state.playerBids[p] || 0),
            0
        );

    updateBidUI();

    /*
       If an existing bidding modal exists,
       allow the user to select/change P1.
    */

    const overlay =
        $("bidOverlay");

    if(overlay){

        overlay.classList.add(
            "show"
        );

    }

}


/* =========================================================
   AI BID
========================================================= */

function calculateAIBid(player){

    const hand =
        state.hands[player] || [];

    let strength = 0;

    let spades = 0;

    let jokers = 0;

    for(const card of hand){

        if(card.joker){

            jokers++;

            strength += 2.5;

            continue;

        }

        if(card.suit === "♠"){

            spades++;

            if(card.value >= 13){

                strength += 1.7;

            }

            else if(card.value >= 10){

                strength += 1.1;

            }

            else{

                strength += .4;

            }

        }

        else{

            if(card.value === 14){

                strength += .9;

            }

            else if(card.value === 13){

                strength += .45;

            }

        }

    }

    let bid =
        Math.round(
            strength
        );

    /*
       Natural range.
    */

    bid =
        Math.max(
            0,
            Math.min(
                7,
                bid
            )
        );

    /*
       Team minimum rule.
    */

    return bid;
}


/* =========================================================
   BID UI
========================================================= */

function updateBidUI(){

    const blue =
        $("blueBidTotal");

    const red =
        $("redBidTotal");

    if(blue){

        blue.textContent =
            state.bids.blue;

    }

    if(red){

        red.textContent =
            state.bids.red;

    }

}


/* =========================================================
   CONFIRM BIDS
========================================================= */

function confirmBids(){

    /*
       Keep P1 bid from UI if selected.
    */

    const selected =
        qs(
            "#blueBidButtons .selected"
        );

    if(selected){

        state.playerBids[1] =
            Number(
                selected.textContent
            );

    }

    state.bids.blue =
        BLUE_TEAM.reduce(
            (sum,p)=>
                sum +
                Number(
                    state.playerBids[p] || 0
                ),
            0
        );

    state.bids.red =
        RED_TEAM.reduce(
            (sum,p)=>
                sum +
                Number(
                    state.playerBids[p] || 0
                ),
            0
        );

    /*
       Team minimum.
    */

    if(
        state.bids.blue < 2 &&
        state.bids.red < 2
    ){

        /*
           AI adjusts naturally.
        */

        if(
            isBlue(1)
        ){

            state.playerBids[1] =
                Math.max(
                    2,
                    state.playerBids[1]
                );

        }

        state.bids.blue =
            BLUE_TEAM.reduce(
                (s,p)=>
                    s +
                    Number(
                        state.playerBids[p] || 0
                    ),
                0
            );

    }

    state.bidHistory.push({

        round:state.round,

        blue:state.bids.blue,

        red:state.bids.red,

        players:{
            ...state.playerBids
        }

    });

    const overlay =
        $("bidOverlay");

    if(overlay){

        overlay.classList.remove(
            "show"
        );

    }

    startRoundPlay();

}


/* =========================================================
   START ROUND
========================================================= */

function startRoundPlay(){

    state.phase = "playing";

    state.round++;

    /*
       Safety:
       round can only be 1..6.
    */

    if(
        state.round > TOTAL_ROUNDS
    ){

        finishGame();

        return;

    }

    state.starter =
        STARTERS[
            state.round - 1
        ];

    state.currentPlayer =
        state.starter;

    state.trickNumber = 0;

    state.trickCards = [];

    state.leadSuit = null;

    updateTopUI();

    highlightPlayer(
        state.currentPlayer
    );

    startTrick();

}


/* =========================================================
   START TRICK
========================================================= */

function startTrick(){

    state.trickNumber++;

    state.trickCards = [];

    state.leadSuit = null;

    state.turnIndex = 0;

    state.currentPlayer =
        getPlayerAtTurn(
            state.starter,
            state.turnIndex
        );

    clearPlayedCards();

    updateCenter(
        "PLAYER " +
        state.currentPlayer +
        " STARTS"
    );

    highlightPlayer(
        state.currentPlayer
    );

    renderHands();

    processCurrentTurn();

}


/* =========================================================
   PLAYER ORDER
========================================================= */

function getPlayerAtTurn(
    starter,
    index
){

    return (
        (
            starter - 1 +
            index
        ) % 6
    ) + 1;

}


/* =========================================================
   CURRENT TURN
========================================================= */

function processCurrentTurn(){

    clearTimeout(
        state.moveTimer
    );

    if(
        state.trickCards.length >= 6
    ){

        finishTrick();

        return;

    }

    const player =
        state.currentPlayer;

    highlightPlayer(player);

    /*
       Human player.
    */

    if(player === 1){

        enableHumanCards();

        startMoveTimer();

        return;

    }

    /*
       AI player.
    */

    state.aiThinking = true;

    disableHumanCards();

    setTimeout(
        ()=>{
            playAI(player);
        },
        450 +
        Math.random()*450
    );

}


/* =========================================================
   HUMAN MOVE TIMER
========================================================= */

function startMoveTimer(){

    clearTimeout(
        state.moveTimer
    );

    state.moveTimer =
        setTimeout(
            ()=>{
                autoPlayHuman();
            },
            MOVE_TIME
        );

}


/* =========================================================
   AUTO PLAY HUMAN
========================================================= */

function autoPlayHuman(){

    if(
        state.currentPlayer !== 1
    ){

        return;

    }

    const legal =
        getLegalCards(1);

    if(!legal.length){

        return;

    }

    /*
       Natural emergency move.
    */

    const card =
        chooseBalancedCard(
            1,
            legal
        );

    playCard(
        1,
        card.id
    );

}


/* =========================================================
   LEGAL CARDS
========================================================= */

function getLegalCards(player){

    const hand =
        state.hands[player] || [];

    if(
        state.trickCards.length === 0
    ){

        /*
           Joker cannot lead.
        */

        const nonJoker =
            hand.filter(
                card => !card.joker
            );

        return nonJoker.length
            ? nonJoker
            : hand;

    }

    const lead =
        state.leadSuit;

    const sameSuit =
        hand.filter(
            card =>
                !card.joker &&
                card.suit === lead
        );

    if(sameSuit.length){

        return sameSuit;

    }

    /*
       If no lead suit,
       any card can be played.
    */

    return hand;

}


/* =========================================================
   HUMAN CARD UI
========================================================= */

function enableHumanCards(){

    const hand =
        $("handP1");

    if(!hand){

        return;

    }

    const legal =
        getLegalCards(1);

    qsa(
        "#handP1 .mini-card"
    ).forEach(
        (element,index)=>{

            const card =
                state.hands[1][index];

            if(!card){

                return;

            }

            const allowed =
                legal.some(
                    c =>
                    c.id === card.id
                );

            element.style.pointerEvents =
                allowed
                    ? "auto"
                    : "none";

            element.style.opacity =
                allowed
                    ? "1"
                    : ".35";

            element.onclick =
                allowed
                    ? ()=>{
                        playCard(
                            1,
                            card.id
                        );
                    }
                    : null;

        }
    );

}


/* =========================================================
   DISABLE HUMAN
========================================================= */

function disableHumanCards(){

    qsa(
        "#handP1 .mini-card"
    ).forEach(
        card=>{

            card.style.pointerEvents =
                "none";

            card.onclick = null;

        }
    );

}


/* =========================================================
   PLAY AI
========================================================= */

function playAI(player){

    if(
        state.currentPlayer !== player
    ){

        return;

    }

    const legal =
        getLegalCards(player);

    if(!legal.length){

        return;

    }

    const card =
        chooseTeamAI(
            player,
            legal
        );

    playCard(
        player,
        card.id
    );

}


/* =========================================================
   TEAM AI
========================================================= */

function chooseTeamAI(
    player,
    legal
){

    const team =
        teamOf(player);

    const partner =
        teammates(player);

    const partnerTricks =
        state.tricks[team];

    const myBid =
        state.playerBids[player] || 0;

    const teamBid =
        state.bids[team];

    const teamNeed =
        teamBid -
        partnerTricks;

    /*
       If partner is currently winning,
       avoid stealing the trick.
    */

    const partnerWinning =
        isPartnerWinning(
            player
        );

    if(partnerWinning){

        const safe =
            legal.filter(
                card =>
                    !wouldBeatCurrentTrick(
                        card
                    )
            );

        if(safe.length){

            return chooseLowest(
                safe
            );

        }

    }

    /*
       If team needs tricks,
       search for strongest winning card.
    */

    if(teamNeed > 0){

        const winning =
            legal.filter(
                card =>
                    wouldBeatCurrentTrick(
                        card
                    )
            );

        if(winning.length){

            /*
               Use the cheapest winner.
            */

            return chooseCheapestWinner(
                winning
            );

        }

    }

    /*
       If team already has enough,
       preserve strong cards.
    */

    if(teamNeed <= 0){

        return chooseConservativeCard(
            player,
            legal
        );

    }

    return chooseBalancedCard(
        player,
        legal
    );

}


/* =========================================================
   PARTNER WINNING
========================================================= */

function isPartnerWinning(player){

    if(
        state.trickCards.length === 0
    ){

        return false;

    }

    const winner =
        getCurrentTrickWinner();

    if(!winner){

        return false;

    }

    return teammates(player)
        .includes(
            winner.player
        );

}


/* =========================================================
   CURRENT TRICK WINNER
========================================================= */

function getCurrentTrickWinner(){

    if(
        !state.trickCards.length
    ){

        return null;

    }

    let best =
        state.trickCards[0];

    for(
        let i=1;
        i<state.trickCards.length;
        i++
    ){

        const current =
            state.trickCards[i];

        if(
            cardBeats(
                current.card,
                best.card,
                state.leadSuit
            )
        ){

            best = current;

        }

    }

    return best;
}


/* =========================================================
   CARD BEATS
========================================================= */

function cardBeats(
    challenger,
    current,
    leadSuit
){

    /*
       RED JOKER
    */

    if(
        challenger.joker &&
        challenger.rank === "RED"
    ){

        if(
            !current.joker ||
            current.rank !== "RED"
        ){

            return true;

        }

    }

    if(
        current.joker &&
        current.rank === "RED"
    ){

        return false;

    }

    /*
       BLACK JOKER
    */

    if(
        challenger.joker &&
        challenger.rank === "BLACK"
    ){

        if(
            !current.joker
        ){

            return true;

        }

    }

    if(
        current.joker &&
        current.rank === "BLACK"
    ){

        return false;

    }

    /*
       Spades trump.
    */

    if(
        challenger.suit === "♠" &&
        current.suit !== "♠"
    ){

        return true;

    }

    if(
        challenger.suit !== "♠" &&
        current.suit === "♠"
    ){

        return false;

    }

    /*
       Different non-trump suits.
    */

    if(
        challenger.suit !==
        current.suit
    ){

        if(
            challenger.suit ===
            leadSuit
        ){

            return true;

        }

        return false;

    }

    return (
        challenger.value >
        current.value
    );

}


/* =========================================================
   WOULD BEAT
========================================================= */

function wouldBeatCurrentTrick(card){

    if(
        state.trickCards.length === 0
    ){

        return false;

    }

    const current =
        getCurrentTrickWinner();

    if(!current){

        return true;

    }

    return cardBeats(
        card,
        current.card,
        state.leadSuit
    );

}


/* =========================================================
   CHOOSE LOWEST
========================================================= */

function chooseLowest(cards){

    return [...cards].sort(
        (a,b)=>
            effectiveStrength(a) -
            effectiveStrength(b)
    )[0];

}


/* =========================================================
   CHEAPEST WINNER
========================================================= */

function chooseCheapestWinner(
    cards
){

    return [...cards].sort(
        (a,b)=>
            effectiveStrength(a) -
            effectiveStrength(b)
    )[0];

}


/* =========================================================
   CONSERVATIVE AI
========================================================= */

function chooseConservativeCard(
    player,
    cards
){

    const safe =
        cards.filter(
            card =>
                !isDangerousCard(
                    card
                )
        );

    if(safe.length){

        return chooseLowest(
            safe
        );

    }

    return chooseLowest(
        cards
    );

}


/* =========================================================
   BALANCED CARD
========================================================= */

function chooseBalancedCard(
    player,
    cards
){

    if(
        state.trickCards.length === 0
    ){

        /*
           Lead with medium strength.
        */

        return [...cards].sort(
            (a,b)=>
                leadScore(a) -
                leadScore(b)
        )[Math.floor(
            cards.length / 3
        )] || cards[0];

    }

    const winning =
        cards.filter(
            card =>
                wouldBeatCurrentTrick(
                    card
                )
        );

    if(winning.length){

        return chooseCheapestWinner(
            winning
        );

    }

    return chooseLowest(
        cards
    );

}


/* =========================================================
   LEAD SCORE
========================================================= */

function leadScore(card){

    if(card.joker){

        return 100;

    }

    if(card.suit === "♠"){

        return 50 + card.value;

    }

    return card.value;

}


/* =========================================================
   EFFECTIVE STRENGTH
========================================================= */

function effectiveStrength(card){

    if(
        card.joker &&
        card.rank === "RED"
    ){

        return 1000;

    }

    if(
        card.joker &&
        card.rank === "BLACK"
    ){

        return 900;

    }

    if(card.suit === "♠"){

        return 500 + card.value;

    }

    return card.value;

}


/* =========================================================
   DANGEROUS CARD
========================================================= */

function isDangerousCard(card){

    if(card.joker){

        return true;

    }

    if(
        card.suit === "♠" &&
        card.value >= 12
    ){

        return true;

    }

    if(
        card.value === 14
    ){

        return true;

    }

    return false;

}


/* =========================================================
   PLAY CARD
========================================================= */

function playCard(
    player,
    cardId
){

    if(
        state.currentPlayer !== player
    ){

        return;

    }

    const hand =
        state.hands[player];

    if(!hand){

        return;

    }

    const index =
        hand.findIndex(
            card =>
                card.id === cardId
        );

    if(index === -1){

        return;

    }

    const card =
        hand[index];

    const legal =
        getLegalCards(player);

    if(
        !legal.some(
            c =>
                c.id === cardId
        )
    ){

        return;

    }

    clearTimeout(
        state.moveTimer
    );

    /*
       Joker cannot lead.
    */

    if(
        state.trickCards.length === 0 &&
        card.joker
    ){

        /*
           If there is no other card,
           the player loses the trick.
           For normal play we reject it
           while legal cards exist.
        */

        const nonJoker =
            hand.filter(
                c => !c.joker
            );

        if(nonJoker.length){

            return;

        }

    }

    hand.splice(
        index,
        1
    );

    /*
       Lead suit.
    */

    if(
        state.trickCards.length === 0 &&
        !card.joker
    ){

        state.leadSuit =
            card.suit;

    }

    /*
       Remember void suit.
    */

    if(
        state.trickCards.length > 0 &&
        !card.joker &&
        card.suit !== state.leadSuit
    ){

        const hasLead =
            hand.some(
                c =>
                    !c.joker &&
                    c.suit ===
                    state.leadSuit
            );

        if(!hasLead){

            state.voidSuits[player]
                [state.leadSuit] =
                true;

        }

    }

    const play = {

        player,

        card,

        order:
            state.trickCards.length

    };

    state.trickCards.push(
        play
    );

    state.playedCards.push(
        play
    );

    state.cardHistory.push({

        round:state.round,

        trick:state.trickNumber,

        player,

        cardId:card.id,

        suit:card.suit,

        rank:card.rank

    });

    /*
       Visual card.
    */

    renderPlayedCard(
        play
    );

    renderHands();

    updateCenter(
        "PLAYER " +
        player +
        " PLAYED"
    );

    /*
       Six cards complete the trick.
    */

    if(
        state.trickCards.length === 6
    ){

        setTimeout(
            finishTrick,
            900
        );

        return;

    }

    /*
       Next player.
    */

    state.turnIndex++;

    state.currentPlayer =
        getPlayerAtTurn(
            state.starter,
            state.turnIndex
        );

    highlightPlayer(
        state.currentPlayer
    );

    setTimeout(
        processCurrentTurn,
        350
    );

}


/* =========================================================
   FINISH TRICK
========================================================= */

function finishTrick(){

    const winner =
        getCurrentTrickWinner();

    if(!winner){

        return;

    }

    const winningTeam =
        teamOf(
            winner.player
        );

    state.tricks[
        winningTeam
    ]++;

    state.trickHistory.push({

        round:state.round,

        trick:state.trickNumber,

        winner:winner.player,

        team:winningTeam,

        cards:
            state.trickCards.map(
                x=>({
                    player:x.player,
                    card:x.card
                })
            )

    });

    updateCenter(
        "PLAYER " +
        winner.player +
        " WINS"
    );

    highlightPlayer(
        winner.player
    );

    setTimeout(
        ()=>{

            if(
                state.trickNumber >=
                CARDS_PER_PLAYER
            ){

                finishRound();

            }else{

                startTrick();

            }

        },
        850
    );

}


/* =========================================================
   ROUND SCORE
========================================================= */

function calculateTeamScore(
    bid,
    tricks
){

    /*
       Bid 7:
       exactly +140 / -140.
    */

    if(bid === 7){

        return tricks >= 7
            ? 140
            : -140;

    }

    /*
       Failed bid.
    */

    if(tricks < bid){

        return -(bid * 10);

    }

    /*
       Successful bid.
       Extra tricks = +1.
    */

    return (
        bid * 10
    ) +
    (
        tricks - bid
    );

}


/* =========================================================
   FINISH ROUND
========================================================= */

function finishRound(){

    state.phase =
        "round-result";

    const blueRound =
        calculateTeamScore(
            state.bids.blue,
            state.tricks.blue
        );

    const redRound =
        calculateTeamScore(
            state.bids.red,
            state.tricks.red
        );

    state.score.blue +=
        blueRound;

    state.score.red +=
        redRound;

    state.roundScores.push({

        round:state.round,

        blueBid:
            state.bids.blue,

        redBid:
            state.bids.red,

        blueTricks:
            state.tricks.blue,

        redTricks:
            state.tricks.red,

        blueScore:
            blueRound,

        redScore:
            redRound,

        blueTotal:
            state.score.blue,

        redTotal:
            state.score.red

    });

    updateScoreUI();

    showRoundScore(
        blueRound,
        redRound
    );

}


/* =========================================================
   ROUND SCORE UI
========================================================= */

function showRoundScore(
    blueRound,
    redRound
){

    const subtitle =
        $("scoreSubtitle");

    if(subtitle){

        subtitle.textContent =
            "ROUND " +
            state.round +
            " / " +
            TOTAL_ROUNDS;

    }

    setText(
        "scoreBlueBid",
        state.bids.blue
    );

    setText(
        "scoreRedBid",
        state.bids.red
    );

    setText(
        "scoreBlueTricks",
        state.tricks.blue
    );

    setText(
        "scoreRedTricks",
        state.tricks.red
    );

    setText(
        "scoreBlueRound",
        blueRound
    );

    setText(
        "scoreRedRound",
        redRound
    );

    setText(
        "scoreBlueTotal",
        state.score.blue
    );

    setText(
        "scoreRedTotal",
        state.score.red
    );

    const overlay =
        $("scoreOverlay");

    if(overlay){

        overlay.classList.add(
            "show"
        );

    }

}


/* =========================================================
   NEXT ROUND
========================================================= */

function nextTrick(){

    const overlay =
        $("scoreOverlay");

    if(overlay){

        overlay.classList.remove(
            "show"
        );

    }

    if(
        state.round >=
        TOTAL_ROUNDS
    ){

        finishGame();

        return;

    }

    /*
       Reset team trick count
       for the next round.
    */

    state.tricks.blue = 0;
    state.tricks.red = 0;

    /*
       Next round.
    */

    dealRound();

}


/* =========================================================
   FINAL GAME
========================================================= */

function finishGame(){

    state.phase =
        "finished";

    clearTimeout(
        state.moveTimer
    );

    const blue =
        state.score.blue;

    const red =
        state.score.red;

    if(blue > red){

        state.winner = "blue";

    }

    else if(red > blue){

        state.winner = "red";

    }

    else{

        state.winner = "draw";

    }

    updateFinalUI();

    const overlay =
        $("resultOverlay");

    if(overlay){

        overlay.classList.add(
            "show"
        );

    }

}


/* =========================================================
   FINAL UI
========================================================= */

function updateFinalUI(){

    setText(
        "finalBlueScore",
        state.score.blue
    );

    setText(
        "finalRedScore",
        state.score.red
    );

    const blueTricks =
        state.roundScores.reduce(
            (sum,r)=>
                sum + r.blueTricks,
            0
        );

    const redTricks =
        state.roundScores.reduce(
            (sum,r)=>
                sum + r.redTricks,
            0
        );

    setText(
        "finalBlueTricks",
        blueTricks +
        " TRICKS WON"
    );

    setText(
        "finalRedTricks",
        redTricks +
        " TRICKS WON"
    );

    const winner =
        $("winnerName");

    if(!winner){

        return;

    }

    if(
        state.winner === "blue"
    ){

        winner.textContent =
            "🔵 BLUE TEAM";

    }

    else if(
        state.winner === "red"
    ){

        winner.textContent =
            "🔴 RED TEAM";

    }

    else{

        winner.textContent =
            "DRAW";

    }

}


/* =========================================================
   UI HELPERS
========================================================= */

function setText(
    id,
    value
){

    const element =
        $(id);

    if(element){

        element.textContent =
            value;

    }

}


/* =========================================================
   TOP UI
========================================================= */

function updateTopUI(){

    if(
        state.round <= 0
    ){

        setText(
            "roundNumber",
            "LOBBY"
        );

        return;

    }

    setText(
        "roundNumber",
        "ROUND " +
        state.round +
        " / " +
        TOTAL_ROUNDS
    );

}


/* =========================================================
   SCORE UI
========================================================= */

function updateScoreUI(){

    setText(
        "blueScore",
        state.score.blue
    );

    setText(
        "redScore",
        state.score.red
    );

}


/* =========================================================
   CENTER
========================================================= */

function updateCenter(
    text
){

    setText(
        "centerText",
        text
    );

}


/* =========================================================
   HIGHLIGHT PLAYER
========================================================= */

function highlightPlayer(
    player
){

    qsa(
        ".player"
    ).forEach(
        element =>
            element.classList.remove(
                "active"
            )
    );

    const element =
        qs(
            ".p" + player
        );

    if(element){

        element.classList.add(
            "active"
        );

    }

}


/* =========================================================
   RENDER HANDS
========================================================= */

function renderHands(){

    for(let p=1;p<=6;p++){

        const container =
            $("handP"+p);

        if(!container){

            continue;

        }

        container.innerHTML = "";

        const hand =
            state.hands[p] || [];

        /*
           Every player sees their own
           complete 9-card hand.
           Other players see card backs.
        */

        for(
            let i=0;
            i<hand.length;
            i++
        ){

            const card =
                hand[i];

            const element =
                document.createElement(
                    "div"
                );

            element.className =
                "mini-card";

            if(p === 1){

                element.textContent =
                    cardLabel(card);

                element.dataset.cardId =
                    card.id;

            }else{

                element.textContent =
                    "♠";

            }

            element.style.zIndex =
                i + 1;

            element.style.transform =
                `translateY(${
                    i % 2
                        ? -2
                        : 0
                }px)`;

            container.appendChild(
                element
            );

        }

    }

    /*
       Reapply click handlers.
    */

    if(
        state.currentPlayer === 1 &&
        state.phase === "playing"
    ){

        enableHumanCards();

    }

}


/* =========================================================
   CARD LABEL
========================================================= */

function cardLabel(card){

    if(card.joker){

        return card.rank === "RED"
            ? "🃏"
            : "🃏";

    }

    return (
        card.rank +
        card.suit
    );

}


/* =========================================================
   PLAYED CARD UI
========================================================= */

function renderPlayedCard(
    play
){

    const cards =
        qsa(
            "#playedCards .played-card"
        );

    const index =
        state.trickCards.length - 1;

    const element =
        cards[index];

    if(!element){

        return;

    }

    element.textContent =
        cardLabel(
            play.card
        );

    element.classList.add(
        "show"
    );

}


/* =========================================================
   CLEAR PLAYED
========================================================= */

function clearPlayedCards(){

    qsa(
        "#playedCards .played-card"
    ).forEach(
        card=>{

            card.classList.remove(
                "show"
            );

            card.textContent = "";

        }
    );

}


/* =========================================================
   CONTINUE / NEXT TRICK COMPATIBILITY
========================================================= */

window.nextTrick =
    nextTrick;

window.confirmBids =
    confirmBids;

window.startGame =
    startGame;


/* =========================================================
   PLAY AGAIN
========================================================= */

function playAgain(){

    const result =
        $("resultOverlay");

    if(result){

        result.classList.remove(
            "show"
        );

    }

    resetGame();

    updateTopUI();

    updateScoreUI();

    renderHands();

    /*
       Start a completely new game.
    */

    startGame();

}

window.playAgain =
    playAgain;


/* =========================================================
   HOME
========================================================= */

function goHome(){

    window.location.href =
        "index.html";

}

window.goHome =
    goHome;


/* =========================================================
   BACK
========================================================= */

function goBack(){

    if(
        state.phase === "playing" ||
        state.phase === "bidding" ||
        state.phase === "dealing"
    ){

        showGameMessage(
            "The current game is still in progress."
        );

        return;

    }

    goHome();

}

window.goBack =
    goBack;


/* =========================================================
   MESSAGE
========================================================= */

function showGameMessage(
    message
){

    /*
       Telegram support if available.
    */

    try{

        if(
            window.Telegram &&
            Telegram.WebApp &&
            typeof Telegram.WebApp.showAlert ===
            "function"
        ){

            Telegram.WebApp.showAlert(
                message
            );

            return;

        }

    }catch(error){}

    alert(message);

}

window.showMessage =
    showGameMessage;


/* =========================================================
   OPTIONAL DEAL ANIMATION COMPATIBILITY
========================================================= */

function startDeal(){

    dealRound();

}

window.startDeal =
    startDeal;


/* =========================================================
   FINISH DEAL COMPATIBILITY
========================================================= */

function finishDeal(){

    const overlay =
        $("dealOverlay");

    if(overlay){

        overlay.classList.remove(
            "show"
        );

    }

    startBidding();

}

window.finishDeal =
    finishDeal;


/* =========================================================
   ENTER TABLE
========================================================= */

function enterGameTable(){

    const overlay =
        $("spadesVideoOverlay");

    if(overlay){

        overlay.classList.remove(
            "show"
        );

    }

    setText(
        "roundNumber",
        "LOBBY"
    );

    const button =
        $("mainButton");

    if(button){

        button.textContent =
            "START GAME";

        button.disabled =
            false;

        button.onclick =
            startGame;

    }

}

window.enterGameTable =
    enterGameTable;


/* =========================================================
   VIDEO COMPATIBILITY
   ---------------------------------------------------------
   The game itself is completely offline.
   Video is handled by game.html if configured.
========================================================= */

let videoEnded = false;

window.videoEnded = false;


/* =========================================================
   INITIALIZATION
========================================================= */

function initGame(){

    resetGame();

    updateTopUI();

    updateScoreUI();

    renderHands();

    /*
       Do not automatically start.
       User enters the table first.
    */

}

initGame();


/* =========================================================
   DEBUG API
   ---------------------------------------------------------
   Useful during development.
========================================================= */

window.SPADES_GAME = {

    state,

    startGame,

    dealRound,

    startBidding,

    confirmBids,

    startRoundPlay,

    startTrick,

    playCard,

    finishTrick,

    finishRound,

    finishGame,

    calculateTeamScore,

    calculateAIBid,

    getLegalCards,

    chooseTeamAI

};


/* =========================================================
   END
========================================================= */
