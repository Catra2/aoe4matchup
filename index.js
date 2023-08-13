/*
        Constants
         */
//Parsing query commands
const queryParams = new URLSearchParams(document.location.search);
const userNameToLookUp = queryParams.get("u");
const userIdToUse = queryParams.get("u_id");

const winResultsDiv = document.querySelector("#win-results");
const customIdInput = document.querySelector("#custom-id-input");
const krtkoId = 5414457;
const walrusId = 7287677;
const goblinGooId = 7546983;

/*
        Data classes
         */
/**
 * Enum for the status of a game
 * @readonly
 * @enum {string}
 */
const GameStatus = {
  PLAYING: "playing",
  FINISHED: "finished",
};

const NO_RESULTS_TEAM_ID = -2;
const STILL_PLAYING_TEAM_ID = -1;

/**
 * @class Game
 * @property id {number}
 * @property status {GameStatus}
 * @property duration {number}
 * @property averageRating {number}
 * @property kind {string}
 * @property leaderboard {string}
 * @property patchId {number}
 * @property seasonNumber {number}
 * @property server {number}
 * @property teamIdWon {number}
 * @property mapName {string}
 * @property players {[Player]}
 * @property startedAt {Date}
 * @property updatedAt {Date}
 */
class Game {
  constructor(id, status, duration, averageRating, kind, leaderboard, patchId, seasonNumber, server, teamIdWon, mapName, players, startedAt, updatedAt) {
    this.id = id;
    this.status = status;
    this.duration = duration;
    this.averageRating = averageRating;
    this.kind = kind;
    this.leaderboard = leaderboard;
    this.patchId = patchId;
    this.seasonNumber = seasonNumber;
    this.server = server;
    this.teamIdWon = teamIdWon;
    this.mapName = mapName;
    this.players = players;
    this.startedAt = startedAt;
    this.updatedAt = updatedAt;
  }

  /**
   * @param player {Player}
   * @return {boolean}
   */
  didPlayerWin(player) {
    let usingTeamId = player.teamId;
    if (usingTeamId < 0) {
      const foundPlayer = this.getPlayerById(player.id);
      if (foundPlayer == null) {
        throw new Error(`Player ${player.id} is not in this game`);
      }
      usingTeamId = foundPlayer.teamId;
    }
    return this.teamIdWon === usingTeamId;
  }

  /**
   * @param playerId {number}
   * @returns {Player|null}
   */
  getPlayerById(playerId) {
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].id === playerId) {
        return this.players[i];
      }
    }
    return null;
  }

  /**
   *
   * @param jsonData {{}}
   * @returns {Game}
   * @constructor
   */
  static FromJson(jsonData) {
    let gameStatus = GameStatus.PLAYING;
    const players = [];
    let whoWon = STILL_PLAYING_TEAM_ID;
    let foundWhoWon = false;
    for (let i = 0; i < jsonData.teams.length; i++) {
      for (let playerIndex = 0; playerIndex < jsonData.teams[i].length; playerIndex++) {
        const playerJson = jsonData.teams[i][playerIndex].player;
        const p = Player.FromJson(i, playerJson);
        players.push(p);

        if (foundWhoWon === false) {
          if (playerJson.result === "win") {
            foundWhoWon = true;
            gameStatus = GameStatus.FINISHED;
            whoWon = i;
          } else if (playerJson.result === "noresult") {
            foundWhoWon = true;
            whoWon = NO_RESULTS_TEAM_ID;
            gameStatus = GameStatus.FINISHED;
          }
        }
      }
    }
    return new Game(jsonData.game_id, gameStatus, jsonData.duration, jsonData.average_rating, jsonData.kind, jsonData.leaderboard, jsonData.patch, jsonData.season, jsonData.server, whoWon, jsonData.map, players, Date.parse(jsonData.started_at), Date.parse(jsonData.updated_at));
  }
}
/**
 * @class Player
 * @property id {number}
 * @property username {string}
 * @property teamId {number}
 * @property rating {number}
 * @property ratingChange {number?}
 * @property civilization {string}
 * @property civilizationRandom {boolean}
 */
class Player {
  constructor(id, username, teamId, rating, ratingChange, civilization, civilizationRandom) {
    this.id = id;
    this.username = username;
    this.teamId = teamId;
    this.rating = rating;
    this.ratingChange = ratingChange;
    this.civilization = civilization;
    this.civilizationRandom = civilizationRandom;
  }

  /**
   * @param teamId {number}
   * @param jsonData {{}}
   * @returns {Player}
   * @constructor
   */
  static FromJson(teamId, jsonData) {
    return new Player(jsonData.profile_id, jsonData.name, teamId, jsonData.rating, jsonData.rating_diff, jsonData.civilization, jsonData.civilization_randomized);
  }
}
/**
 * @class User
 * @property id {number}
 * @property steamId {number}
 * @property username {string}
 * @property mediumAvatarImageUrl {string}
 */
class User {
  //todo a lot more fields can be serialized out
  constructor(id, steamId, username, mediumAvatarImageUrl) {
    this.id = id;
    this.steamId = steamId;
    this.username = username;
    this.mediumAvatarImageUrl = mediumAvatarImageUrl;
  }

  /**
   * @param jsonData {{}}
   * @returns {User}
   * @constructor
   */
  static FromJson(jsonData) {
    return new User(jsonData.profile_id, jsonData.steam_id, jsonData.name, jsonData.avatars.medium);
  }
}

/**
 * @class Aoe4WorldApiService
 * Api services to talk to AOE4 World
 */
class Aoe4WorldApiService {
  /**
   * @param playerId {number}
   * @param opponentId {number=}
   * @param limit {number=}
   * @returns {Promise<[Game]>}
   */
  async getGames(playerId, opponentId = -1, limit = -1) {
    let apiUrl = `https://aoe4world.com/api/v0/players/${playerId}/games`;
    let queryParams = null;
    if (limit > 0) {
      queryParams = new URLSearchParams();
      queryParams.set("limit", limit.toString());
    }
    if (opponentId > 0) {
      if (queryParams === null) {
        queryParams = new URLSearchParams();
      }
      queryParams.set("opponent_profile_id", opponentId.toString());
    }
    if (queryParams !== null) {
      apiUrl += "?";
      apiUrl += queryParams.toString();
    }
    const results = await fetch(apiUrl);
    const responseJson = await results.json();

    let games = [];
    for (let i = 0; i < responseJson.games.length; i++) {
      const gameJson = responseJson.games[i];
      const game = Game.FromJson(gameJson);
      games.push(game);
    }
    return games;
  }

  /**
   * @param playerId {number}
   * @param game {Game}
   * @returns {Promise<{number: [Game]}>}
   * @constructor
   */
  async getMatchUpsFromGame(playerId, game) {
    const playerTeam = game.getPlayerById(playerId).teamId;
    const matchUpPromises = {};
    const promises = [];
    for (let i = 0; i < game.players.length; i++) {
      const opponent = game.players[i];
      if (opponent.teamId === playerTeam || opponent.id === playerId) {
        continue;
      }

      const matchUpGamesPromise = this.getGames(playerId, opponent.id);
      matchUpPromises[opponent.id] = matchUpGamesPromise;
      promises.push(matchUpGamesPromise);
    }

    await Promise.all(promises);
    const keys = Object.keys(matchUpPromises);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      matchUpPromises[key] = await matchUpPromises[key];
    }
    return matchUpPromises;
  }
  /**
   * @param username {string}
   * @param exact {boolean=}
   * @param limit {number=}
   * @returns {Promise<[User]>}
   */
  async getUsersByUsername(username, exact, limit) {
    let apiUrl = `https://aoe4world.com/api/v0/players/search?query=${username}`;
    if (exact) {
      apiUrl += `&exact=true`;
    }
    if (limit && limit > 0) {
      apiUrl += `&limit=${limit}`;
    }
    const results = await fetch(apiUrl);
    const responseJson = await results.json();
    const users = [];
    for (let i = 0; i < responseJson.players.length; i++) {
      const playerJson = responseJson.players[i];
      users.push(User.FromJson(playerJson));
    }
    return users;
  }
  /**
   * @param userId {number}
   * @returns {Promise<User>}
   */
  async getUsersById(userId) {
    const apiUrl = `https://aoe4world.com/api/v0/players/${userId}`;
    const results = await fetch(apiUrl);
    const responseJson = await results.json();
    return User.FromJson(responseJson);
  }

  /**
   * @param username
   * @returns {Promise<User|null>}
   */
  async attemptToFindUserByUsername(username) {
    let users = await this.getUsersByUsername(username, true, 1);
    if (users.length !== 0) {
      return users[0];
    }
    users = await this.getUsersByUsername(username, false, 1);
    if (users.length !== 0) {
      return users[0];
    }
    return null;
  }
}

/**
 * Enum for the status of a game
 * @readonly
 * @enum {string}
 */
const MatchUpCheckerStatus = {
  INIT: "init",
  RUNNING: "running",
  FINISHED_SUCCESSFULLY: "finished_successfully",
  FAILED_COULD_NOT_FIND_GAME: "failed_could_not_find_game",
};

/**
 * @class MatchUpChecker
 *
 * @property status {MatchUpCheckerStatus}
 * @property statusPromise {Promise<MatchUpCheckerStatus>?}
 * @property aoe4Api {Aoe4WorldApiService}
 * @property userId {number}
 * @property findGameAfterDate {Date}
 * @property timeAtFail {Date}
 * @property msTillRetry {number}
 *
 * @property user {User?}
 * @property game {Game?}
 * @property matchUps {{number:[Game]}?}
 *
 *
 * @private _attempts {number}
 * @private _resolve {function?}
 *
 *
 */
class MatchUpChecker {
  constructor(userId, aoe4Api) {
    const now = Date.now();
    // const msUntilFail = 5 * 60 * 1000;
    const msUntilFail = 10 * 1000;
    this.status = MatchUpCheckerStatus.INIT;
    this.statusPromise = null;
    this.userId = userId;
    this.aoe4Api = aoe4Api;
    this.findGameAfterDate = new Date(now - 3000); // allow to find games 3 seconds ago
    this.timeAtFail = new Date(now + msUntilFail);

    this.user = null;
    this.game = null;
    this.matchUps = null;

    this._attempts = 0;
    this._resolve = null;

    this.msTillRetry = 3000;
  }

  /**
   *
   * @returns {Promise<MatchUpCheckerStatus>}
   */
  async start() {
    if (this.status !== MatchUpCheckerStatus.INIT) {
      return this.statusPromise;
    }
    this.status = MatchUpCheckerStatus.RUNNING;
    this.statusPromise = new Promise((resolve, reject) => this._handle(resolve));
    return this.statusPromise;
  }

  async _handle(resolve, reject) {
    this._resolve = resolve;
    if (this.user === null) {
      this.user = await this.aoe4Api.getUsersById(this.userId);
    }
    this._findRecentGame();
  }

  async _findRecentGame() {
    const recentGames = await this.aoe4Api.getGames(this.userId, -1, 1);
    if (recentGames.length === 0) {
      //fail
      this._failedToFindGameLoop();
      return;
    }

    const recentGame = recentGames[0];
    if (recentGame.startedAt < this.findGameAfterDate || recentGame.status !== GameStatus.PLAYING) {
      //fail
      this._failedToFindGameLoop();
      return;
    }

    //found the right game
    this.game = recentGame;
    this.matchUps = await this.aoe4Api.getMatchUpsFromGame(this.userId, recentGame);
    this.status = MatchUpCheckerStatus.FINISHED_SUCCESSFULLY;
    this._resolve(this.status);
  }

  async _failedToFindGameLoop() {
    this._attempts++;
    const now = Date.now();
    if (now > this.timeAtFail.getTime()) {
      this.status = MatchUpCheckerStatus.FAILED_COULD_NOT_FIND_GAME;
      this._resolve(this.status);
      return;
    }
    setTimeout(() => {
      this._findRecentGame();
    }, this.msTillRetry);
  }
}

/*
        Scoped objects
         */
const aoe4ApiService = new Aoe4WorldApiService();

/*
            UI callbacks
         */
/**
 * @param mainUser {User}
 * @param fromGame {Game}
 * @param matchUps {{number: [Game]}}
 */
function OnRenderMatchUpUI(mainUser, fromGame, matchUps) {
  let htmlResults = "";
  const mainPlayer = fromGame.getPlayerById(mainUser.id);
  for (let i = 0; i < fromGame.players.length; i++) {
    const opponent = fromGame.players[i];
    if (opponent.teamId === mainPlayer.teamId || opponent.id === mainPlayer.id) {
      continue;
    }
    const matchUpGames = matchUps[opponent.id];
    htmlResults += `Games against ${opponent.username}:<br>`;
    if (matchUpGames === undefined || matchUpGames === null) {
      htmlResults += `-<br>`;
      continue;
    }
    for (let gameIndex = 0; gameIndex < matchUpGames.length; gameIndex++) {
      const game = matchUpGames[gameIndex];
      const myPlayerInGame = game.getPlayerById(mainUser.id);
      htmlResults += `Game - didWin ${game.teamIdWon === myPlayerInGame.teamId} - ${game.startedAt}<br>`;
      htmlResults += `<a target="_blank" href="https://aoe4world.com/players/${mainUser.id}/games/${game.id}">Game data</a><br>`;
    }
    htmlResults += "<br><br><br>";
  }

  winResultsDiv.innerHTML = htmlResults;
}

/*
            Page routing
         */
async function RouteFindMatchUpsWithUsername(username) {
  const user = await aoe4ApiService.attemptToFindUserByUsername(username);
  RouteFindMatchUpsWithUser(user);
}
async function RouteFindMatchUpsWithId(userId) {
  const user = await aoe4ApiService.getUsersById(userId);
  RouteFindMatchUpsWithUser(user);
}
async function RouteFindRecentGame(userId) {
  const findRecentMatchUp = new MatchUpChecker(userId, aoe4ApiService);
  const results = await findRecentMatchUp.start();
  if (results === MatchUpCheckerStatus.FINISHED_SUCCESSFULLY) {
    OnRenderMatchUpUI(findRecentMatchUp.user, findRecentMatchUp.game, findRecentMatchUp.matchUps);
  } else {
    console.error("failed");
  }
}
async function RouteFindMatchUpsWithUser(user) {
  const recentGames = await aoe4ApiService.getGames(user.id, -1, 1);
  const recentGame = recentGames[0];
  const matchUps = await aoe4ApiService.getMatchUpsFromGame(user.id, recentGame);
  OnRenderMatchUpUI(user, recentGame, matchUps);
}
async function CheckCustomId() {
  RouteFindMatchUpsWithId(parseInt(customIdInput.value));
}

if (userIdToUse !== null) {
  RouteFindMatchUpsWithId(parseInt(userIdToUse));
} else if (userNameToLookUp !== null) {
  RouteFindMatchUpsWithUsername(userNameToLookUp);
}
