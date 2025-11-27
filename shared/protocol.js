// Protocolo de comunicación WebSocket
// Eventos del cliente al servidor
export const CLIENT_EVENTS = {
    PLAYER_JOIN: 'player:join',
    GAME_INPUT: 'game:input',
    DISCONNECT: 'disconnect',
};
// Eventos del servidor al cliente
export const SERVER_EVENTS = {
    PLAYER_JOINED: 'player:joined',
    GAME_STATE: 'game:state',
    GAME_START: 'game:start',
    GAME_END: 'game:end',
    PLAYER_DEAD: 'player:dead',
    ERROR: 'error',
};
