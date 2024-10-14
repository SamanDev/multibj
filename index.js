// Websocket server
const { log } = require("console");
const express = require("express");
const { url } = require("inspector");
const { setTimeout } = require("timers");
const axios = require("axios").create({ baseUrl: "http://127.0.0.1:8081" });

const app = express();
const server = require("http").createServer(app);
const PORT = process.env.PORT || 8080;
const WebSocket = require("ws");

const wss = new WebSocket.Server({ server: server });

const suit = ["Heart", "Diamond", "Spade", "Club"];
// Cards (values)
const values = [
    {
        card: "A",
        value: [1, 11],
        hasAce: true,
    },
    {
        card: "2",
        value: 2,
    },
    {
        card: "3",
        value: 3,
    },
    {
        card: "4",
        value: 4,
    },
    {
        card: "5",
        value: 5,
    },
    {
        card: "6",
        value: 6,
    },
    {
        card: "7",
        value: 7,
    },
    {
        card: "8",
        value: 8,
    },
    {
        card: "9",
        value: 9,
    },
    {
        card: "10",
        value: 10,
    },
    {
        card: "J",
        value: 10,
    },
    {
        card: "Q",
        value: 10,
    },
    {
        card: "K",
        value: 10,
    },
];
const valuestest = [
    {
        card: "A",
        value: [1, 11],
        hasAce: true,
    },
    {
        card: "2",
        value: 2,
    },
    {
        card: "3",
        value: 3,
    },
];
let deck = [];
function getDeck() {
    if(deck.length<20){
    // Loop through suite AND values
    for (let i = 0; i < 6; i++) {
        for (let s = 0; s < suit.length; s++) {
            for (let v = 0; v < values.length; v++) {
                let card = { suit: suit[s], value: values[v] };
                deck.push(card);
            }
        }
    }
    shuffle(deck);
}
}
const cacheDuration = 1000 * 60 * 60 * 24 * 365; // 1 year
const guid = () => {
    const s4 = () =>
        Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    return `${s4() + s4()}-${s4()}-${s4()}-${s4()}-${s4() + s4() + s4()}`;
};
var idcode = guid();

// Serve all the static files, (ex. index.html app.js style.css)
app.use(
    express.static("public", {
        maxAge: cacheDuration,
        setHeaders: (res, path) => {
            // Set caching headers
            res.setHeader("Cache-Control", `public, max-age=${cacheDuration}`);
            res.setHeader("Expires", new Date(Date.now() + cacheDuration).toUTCString());
        },
    })
);

server.listen(PORT, () => console.log(`Listening on ${process.env.PORT} or 8080`));

// hashmap clients
const clients = {};
const games = [];
const players = {};
const spectators = {};

const createSeats = (seats) => {
    var _seats = [];
    for (let i = 0; i < seats; i++) {
        _seats.push({});
    }
    return _seats;
};

const createTable = (gameId, min, seats) => {
    games.push({
        id: gameId,
        players: createSeats(seats),
        sideBets: [],
        dealer: {
            cards: [],
            hiddencards: [],
            sum: null,
            hasAce: false,
            hasLeft: null,
        },
        gameOn: false,
        gameStart: false,
        currentPlayer: 10,
        min: min,
        seats: seats,
        startTimer: -1,
        timer: -1,
        idcode: guid(),
    });
};

function shuffle(deck) {
    // Shuffle by 2 random locations 1000 times
    for (let i = 0; i < 1000; i++) {
        let location1 = Math.floor(Math.random() * deck.length);
        let location2 = Math.floor(Math.random() * deck.length);
        let tmp = deck[location1];

        deck[location1] = deck[location2];
        deck[location2] = tmp;
    }
}
createTable("BJ01", 50, 7);
createTable("BJ02", 100, 6);
createTable("BJ03", 200, 5);
createTable("BJ04", 500, 4);

function updateCurrentPlayer(gameId, curNow) {
    //console.log(gameId, curNow);

    const game = games.filter((game) => game.id === gameId)[0];
    game.players.map(function (player, playNum) {
        if (game.players[playNum]?.bet && playNum >= curNow && game.currentPlayer == curNow && game.players[playNum]?.sum < 21) {
            game.currentPlayer = playNum;
        }
    });

    if (game.currentPlayer == curNow) {
        // PUSH DEALER TO PLAYER ARRAY
        // players.push(dealer);
        game.currentPlayer = curNow + 1;
        outputCardSumDealer(gameId);
    }

    const payLoad = {
        method: "tables",
        games: games,
    };
    sendToAll(payLoad);
}
function outputCardSumDealer(gameId) {
    const game = games.filter((game) => game.id === gameId)[0];

    if (game.dealer.sum < 17) {
        addCardDealer(gameId, 800, true);
    } else {
        winLoseComponents(gameId);
    }
}
function sendToAll(payLoad) {
    for (var prop in clients) {
        if (clients.hasOwnProperty(prop)) {
            if (clients[prop]?.ws) {
                clients[prop].ws.send(JSON.stringify(payLoad));
            }
        }
    }
}
function getHigh(data) {
    var hand = data;
    try {
        hand = data.toString();
    } catch (error) {}

    if (hand.indexOf("A") > -1 || hand == "14" || hand.indexOf("14") > -1) return 14;
    if (hand.indexOf("K") > -1 || hand == "13" || hand.indexOf("13") > -1) return 13;
    if (hand.indexOf("Q") > -1 || hand == "12" || hand.indexOf("12") > -1) return 12;
    if (hand.indexOf("J") > -1 || hand == "11" || hand.indexOf("11") > -1) return 11;
    if (hand.indexOf("T") > -1 || hand == "10" || hand.indexOf("10") > -1) return 10;
    if (hand.indexOf("9") > -1) return 9;
    if (hand.indexOf("8") > -1) return 8;
    if (hand.indexOf("7") > -1) return 7;
    if (hand.indexOf("6") > -1) return 6;
    if (hand.indexOf("5") > -1) return 5;
    if (hand.indexOf("4") > -1) return 4;
    if (hand.indexOf("3") > -1) return 3;
    if (hand.indexOf("2") > -1) return 2;
    if (hand.indexOf("1") > -1) return 1;
}
function isStraight(ranks) {
    ranks.sort();

    return (ranks[0] + 1 == ranks[1] || (ranks[0] == 14 && ranks[1] == 2)) && ranks[1] + 1 == ranks[2];
}

function checkSideBets(gameId) {
    const game = games.filter((game) => game.id === gameId)[0];
    const players = game.players;
    var dealerCard = game.dealer.cards[0];
    players.forEach((c, i) => {
        if (c?.bet > 0) {
            var cards = c.cards;
            c.sideppx = 0;

            if (cards[0].value.card == cards[1].value.card) {
                c.sideppx = 5;
                if (cards[0].suit == cards[1].suit) {
                    c.sideppx = 25;
                } else if (cards[0].suit.replace("Club", "Spade").replace("Heart", "Diamond") == cards[1].suit.replace("Club", "Spade").replace("Heart", "Diamond")) {
                    c.sideppx = 12;
                }
            }
            c.side213x = 0;
            var arrayStraight = [getHigh(cards[0].value.card), getHigh(cards[1].value.card), getHigh(dealerCard.value.card)];
            if (cards[0].value.card == cards[1].value.card && cards[0].value.card == dealerCard.value.card) {
                c.side213x = 30;
                if (cards[0].suit == cards[1].suit && cards[0].suit == dealerCard.suit) {
                    c.side213x = 100;
                }
            } else if (isStraight(arrayStraight)) {
                c.side213x = 10;
                if (cards[0].suit == cards[1].suit && cards[0].suit == dealerCard.suit) {
                    c.side213x = 40;
                }
            } else if (cards[0].suit == cards[1].suit && cards[0].suit == dealerCard.suit) {
                c.side213x = 5;
            }
        }
    });

    game.sideBets
        .filter((sideBet) => sideBet?.mode == "PerfectPer")
        .map(function (bet) {
            var x = game.players[bet.seat]?.sideppx ? game.players[bet.seat].sideppx : 0;
            //console.log(cards,bet)
            if (x > 0) {
                bet.x = "x" + x;
                bet.win = bet.amount * x;

                var data = { gameName: "BlackjackMulti", data: [{ username: bet.nickname, bet1: bet.win }], id: game.idcode + bet.seat + bet.mode + bet.nickname };
                changeBalance("gamesEndGame", data);
            }

            //console.log(cards, bet);

            //console.log()
        });
    game.sideBets
        .filter((sideBet) => sideBet?.mode == "21+3")
        .map(function (bet) {
            var x = game.players[bet.seat]?.side213x ? game.players[bet.seat].side213x : 0;
            //console.log(cards,bet)
            if (x > 0) {
                bet.x = "x" + x;
                bet.win = bet.amount * x;

                var data = { gameName: "BlackjackMulti", data: [{ username: bet.nickname, bet1: bet.win }], id: game.idcode + bet.seat + bet.mode + bet.nickname };
                changeBalance("gamesEndGame", data);
                //console.log(cards, bet);
            }
            //console.log()
        });
    startTableTimer(gameId, game.currentPlayer, true);
}
function startBetTimer(gameId, blnStart) {
    const game = games.filter((game) => game.id === gameId)[0];

    if (blnStart) {
        game.startTimer = 20;
        const payLoad = {
            method: "tables",
            games: games,
        };
        sendToAll(payLoad);
    } else {
        game.startTimer = game.startTimer - 1;
        const payLoad = {
            method: "timer",
            gameId: gameId,
            sec: game.startTimer,
        };
        sendToAll(payLoad);
    }

    if (game.startTimer > -1) {
        setTimeout(() => startBetTimer(gameId, false), 1000);
    } else {
        startDeal(gameId);

        const players = game.players;

        players.forEach((c, i) => {
            if (c?.bet > 0) {
                var data = { gameName: "BlackjackMulti", data: [{ username: c.nickname, bet1: c.bet }], id: game.idcode + i };
                changeBalance("gamesStartGame", data);
            }
        });
        const playersSide = game.sideBets;

        playersSide.forEach((c) => {
            var data = { gameName: "BlackjackMulti", data: [{ username: c.nickname, bet1: c.amount }], id: game.idcode + c.seat + c.mode + c.nickname };
            changeBalance("gamesStartGame", data);
        });
    }
}
function startTableTimer(gameId, seat, blnStart) {
    const game = games.filter((game) => game.id === gameId)[0];
    //console.log(game.currentPlayer);

    if (game.currentPlayer == 10 || game.dealer.cards.length > 1) {
        return false;
    }
    if (blnStart) {
        game.timer = 20;
        const payLoad = {
            method: "tables",
            games: games,
        };
        sendToAll(payLoad);
    } else {
        game.timer = game.timer - 1;
        const payLoad = {
            method: "timer",
            gameId: gameId,
            sec: game.timer,
        };
        sendToAll(payLoad);
    }

    if (game.timer > -1) {
        if (game.currentPlayer != seat) {
            game.timer = 10;
            startTableTimer(gameId, game.currentPlayer, true);
        } else {
            setTimeout(() => startTableTimer(gameId, seat, false), 1000);
        }
    } else {
        updateCurrentPlayer(gameId, seat);
        setTimeout(() => startTableTimer(gameId, game.currentPlayer, true), 1000);
    }
}
function startDeal(gameId) {
    const game = games.filter((game) => game.id === gameId)[0];

    getDeck();
    var leftCard = 0;
    game.players.map(function (player, playNum) {
        if (game.players[playNum]?.bet) {
            leftCard = leftCard + 1;
            addCard(gameId, playNum, leftCard * 250);
        } else {
            game.players[playNum] = {};
        }
    });
    leftCard = leftCard + 1;
    addCardDealer(gameId, leftCard * 250);
    leftCard = leftCard + 1;
    game.players.map(function (player, playNum) {
        if (game.players[playNum]?.bet) {
            leftCard = leftCard + 1;
            addCard(gameId, playNum, leftCard * 250);
        } else {
            game.players[playNum] = {};
        }
    });
    leftCard = leftCard + 1;

    addCardDealerfake(gameId, leftCard * 250);
    
}
function addCard(gameId, playNum, timeout) {
    setTimeout(() => {
        console.log(deck.length)
        const game = games.filter((game) => game.id === gameId)[0];
        game.players[playNum].cards.push(deck[0]);
        deck.shift();
        updateSumDeal(gameId);
        if (game.gameOn == false) {
            game.gameOn = true;
        }
        if (game.players[playNum].sum == 21 && game.players[playNum].cards.length == 2) {
            game.players[playNum].blackjack = true;
            updateCurrentPlayer(gameId, playNum);
        }
        if (game.players[playNum].sum >= 21 || game.players[playNum].isDouble) {
            updateCurrentPlayer(gameId, playNum);
        }

        const payLoad = {
            method: "tables",
            games: games,
        };
        sendToAll(payLoad);
    }, timeout);
}
function addCardDealer(gameId, timeout, compare) {
    setTimeout(() => {
        const game = games.filter((game) => game.id === gameId)[0];
        game.dealer.cards.push(deck[0]);
        deck.shift();
        updateSumDeal(gameId);

        if (game.dealer.sum == 21 && game.dealer.cards.length == 2) {
            game.dealer.blackjack = true;
            winLoseComponents(gameId);
        }
        if (game.dealer.sum >= 17) {
            winLoseComponents(gameId);
        }
        if (game.dealer.sum < 17 && compare) {
            addCardDealer(gameId, timeout, compare);
        }

        const payLoad = {
            method: "tables",
            games: games,
        };
        sendToAll(payLoad);
    }, timeout);
}
function addCardDealerfake(gameId, timeout, compare) {
    setTimeout(() => {
        const game = games.filter((game) => game.id === gameId)[0];
        game.dealer.hiddencards.push({
            suit: "Back",
            value: {
                card: "0",
                value: 0,
            },
        });

        updateSumDeal(gameId);
       
        const payLoad = {
            method: "tables",
            games: games,
        };
        sendToAll(payLoad);
        checkSideBets(gameId);
    }, timeout);
}
function winLoseComponents(gameId) {
    const game = games.filter((game) => game.id === gameId)[0];

    game.players.map(function (player, playNum) {
        if (game.players[playNum]?.bet && game.players[playNum]?.sum <= 21) {
            if (game.dealer.sum > 21) {
                if (game.players[playNum].blackjack) {
                    game.players[playNum].win = 1.5 * game.players[playNum].bet + game.players[playNum].bet;
                } else {
                    game.players[playNum].win = game.players[playNum].bet * 2;
                }
            } else {
                if (game.dealer.sum < game.players[playNum]?.sum) {
                    if (game.players[playNum].blackjack) {
                        game.players[playNum].win = 1.5 * game.players[playNum].bet + game.players[playNum].bet;
                    } else {
                        game.players[playNum].win = game.players[playNum].bet * 2;
                    }
                }
                if (game.dealer.sum == game.players[playNum]?.sum) {
                    game.players[playNum].win = game.players[playNum].bet;
                }
            }
        }
    });
    
    game.players.forEach((c,i) => {
        if (c.win && c.win > 0) {
            if (c.isDouble){
                var data = { gameName: "BlackjackMulti", data: [{ username: c.nickname, bet1: c.win }], id: game.idcode + i+"2" };
            }else{
                var data = { gameName: "BlackjackMulti", data: [{ username: c.nickname, bet1: c.win }], id: game.idcode + i };
            }
          
                changeBalance("gamesEndGame", data);
        }
    });
    
    setTimeout(() => {
        game.players.map(function (player, playNum) {
            if (game.players[playNum]?.bet) {
                game.players[playNum].bet = 0;
                game.players[playNum].win = 0;
                game.players[playNum].blackjack = false;

                game.players[playNum].isDouble = false;

                game.players[playNum].sum = 0;
                game.players[playNum].cards = [];
                game.players[playNum].sideppx = 0;
                game.players[playNum].side213x = 0;
            }
        });
        game.dealer = {
            cards: [],
            hiddencards: [],
            sum: null,
            hasAce: false,
            hasLeft: null,
        };
        game.sideBets = [];
        game.gameOn = false;
        game.gameStart = false;
        game.currentPlayer = 10;
        game.idcode = guid();
        game.timer = -1;
        game.startTimer = 1;
        const payLoad = {
            method: "tables",
            games: games,
        };
        sendToAll(payLoad);
    }, 7000);
}
function updateSumDeal(gameId) {
    const game = games.filter((game) => game.id === gameId)[0];

    game.players.map(function (player, playNum) {
        var _sum = 0;
        var haveAce = false;

        if (player.bet && player?.cards) {
            game.players[playNum].cards.map(function (card) {
                var _val = card.value.value;
                if (typeof _val === "object" && _val !== null) {
                    haveAce = true;
                    _val = _val[0];
                }
                _sum = _sum + _val;
            });
            if (haveAce) {
                if (_sum + 10 <= 21) {
                    _sum = _sum + 10;
                }
            }
            game.players[playNum].sum = _sum;
        }
    });
    var _sum = 0;
    var haveAce = false;
    if (game.dealer?.cards) {
        game.dealer.cards.map(function (card) {
            var _val = card?.value?.value;
            if (typeof _val === "object" && _val !== null) {
                haveAce = true;
                _val = _val[0];
            }
            _sum = _sum + _val;
        });
        if (haveAce) {
            if (_sum + 10 <= 21) {
                _sum = _sum + 10;
            }
        }
        game.dealer.sum = _sum;
    }
}
wss.on("connection", (ws) => {
    // wsServer || wss AND request || connection
    // Someone trying to connect
    // const connection = connection.accept(null, connection.origin);

    ws.on("close", () => {
        // connection || wss
        console.log("closed");
    });

    ws.on("message", (message) => {
        // connection || wss
        const result = JSON.parse(message);

        // a user want to create a new game

        if (result.method === "join") {
            const gameId = result.gameId;
            const seat = result.seat;
            const theClient = result.theClient;
            const game = games.filter((game) => game.id === gameId)[0];

            if (!game.players[seat]?.nickname) {
                game.players[seat] = theClient;

                const payLoad = {
                    method: "tables",
                    games: games,
                };
                sendToAll(payLoad);
            }
        }
        if (result.method === "bet") {
            const gameId = result.gameId;
            const seat = result.seat;
            const amount = result.amount;
            const game = games.filter((game) => game.id === gameId)[0];
            if (game.players[seat].bet == 0) {
                game.players[seat].bet = amount;
                game.players[seat].balance = game.players[seat].balance - amount;
                theClient.balance = theClient.balance - amount;

                const userPayload = {
                    method: "connect",
                    theClient: theClient,
                };
                ws.send(JSON.stringify(userPayload));

                if (game.currentPlayer > seat) {
                    game.currentPlayer = seat;
                }
                const payLoad = {
                    method: "tables",
                    games: games,
                };
                sendToAll(payLoad);
            }

            if (!game.gameStart) {
                game.gameStart = true;
                startBetTimer(gameId, true);
            }
        }
        if (result.method === "sidebet") {
            const gameId = result.gameId;
            const seat = result.seat;
            const amount = result.amount;
            const theClient = result.theClient;
            const mode = result.mode;
            const game = games.filter((game) => game.id === gameId)[0];
            var _sideBet = {
                seat: seat,
                amount: amount,
                mode: mode,
                nickname: theClient.nickname,
                win: 0,
                x: null,
            };

            game.players[seat].balance = game.players[seat].balance - amount;
            theClient.balance = theClient.balance - amount;

            const userPayload = {
                method: "connect",
                theClient: theClient,
            };
            ws.send(JSON.stringify(userPayload));
            game.sideBets.push(_sideBet);

            const payLoad = {
                method: "tables",
                games: games,
            };
            sendToAll(payLoad);
        }
        if (result.method === "hit") {
            const gameId = result.gameId;
            const seat = result.seat;

            const game = games.filter((game) => game.id === gameId)[0];

            addCard(gameId, seat, 0);
        }
        if (result.method === "double") {
            const gameId = result.gameId;
            const seat = result.seat;

            const game = games.filter((game) => game.id === gameId)[0];
            var data = { gameName: "BlackjackMulti", data: [{ username: game.players[seat].nickname, bet1: game.players[seat].bet }], id: game.idcode+seat+"2" };

           

            changeBalance("gamesStartGame", data);
            game.players[seat].bet = game.players[seat].bet * 2;
            game.players[seat].isDouble = true;
            addCard(gameId, seat, 0);
        }
        if (result.method === "stand") {
            const gameId = result.gameId;
            const seat = result.seat;
            const game = games.filter((game) => game.id === gameId)[0];
            if (seat == game.currentPlayer) {
                updateCurrentPlayer(gameId, seat);
            }
        }
        if (result.method === "leave") {
            const gameId = result.gameId;
            const seat = result.seat;

            const game = games.filter((game) => game.id === gameId)[0];

            game.players[seat] = {};

            const payLoad = {
                method: "tables",
                games: games,
            };
            sendToAll(payLoad);
        }

        if (result.method === "syncBalance") {
            if (theClient?.nickname) {
                theClient.balance = result.balance;

                const payLoad = {
                    method: "connect",

                    theClient: theClient,
                };
                ws.send(JSON.stringify(payLoad));
            }
        }
    });
    // The ClientId
    var _token = ws._protocol;
    const clientId = _token;
    // The Client
    clients[clientId] = {
        ws: ws,
    };

    // The client object
    let theClient = {
        nickname: "",
        avatar: "",
        cards: [],
        bet: 0,
        balance: 5000,
        sum: null,
        hasAce: false,
        isReady: false,
        blackjack: false,
        isDouble: false,
        hasLeft: false,
        win: 0,
    };
    let player = null;
    // The players Array

    players[theClient] = {
        ws: ws,
    };
    players[player] = {
        ws: ws,
    };
    // The spectator Array
    spectators[theClient] = {
        ws: ws,
    };

    // Send this to client

    getUser(_token, clientId, theClient, ws);

    // Send the payLoad to the client
});

const getUser = async (token, clientId, theClient, ws) => {
    var data = await getUserService(token).then((userdata) => {
        theClient.balance = userdata.balance;
        theClient.nickname = userdata.username;
        theClient.avatar = "lvl" + userdata.level;

        const userLoad = {
            method: "connect",
            clientId: clientId,
            theClient: theClient,
        };
        //console.log(payLoad);
        ws.send(JSON.stringify(userLoad));
        const payLoad = {
            method: "tables",
            games: games,
        };

        ws.send(JSON.stringify(payLoad));
    });
};
const changeBalance = async (com, data) => {
   // console.log(com, data);
    const userdata = await getChipService(com, data);

    //console.log(userdata);
};

const getUserService = (token) => {
    return axios({
        url2: "http://127.0.0.1:8081/api/req/gamesGetUser",
        url: "https://api.glxypkr.com/api/req/gamesGetUser",
        method: "get",
        headers: {
            Authorization: token ? `LooLe  ${token}` : null,
        },
    })
        .then((response) => {
            return response.data;
        })
        .catch((err) => {
            return err;
        });
};
const getChipService = (com, data) => {
    return axios({
        url2: "http://127.0.0.1:8081/api/req/nodeService/" + com,
        url: "https://api.glxypkr.com/api/req/nodeService/" + com,
        method: "post",

        data,
    })
        .then((response) => {
            //console.log(response.data);
            return response.data;
        })
        .catch((err) => {
            return err;
        });
};
// Generates unique guid (i.e. unique user ID)

// Random Part ID
function partyId() {
    var result = "";
    var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var charactersLength = characters.length;
    for (var i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
