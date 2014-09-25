/*
    Copyright (C) 2014  PencilBlue, LLC

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

/**
 * Brokers messages using Redis as the medium.  The implementation follows a
 * publish/subscribe model that allows for listening for changes based on a a
 * specified channel.
 * @class RedisCommandBroker
 * @constructor
 */
function RedisCommandBroker(){
    
    /**
     * The cursor that trails the collection looking for new items
     * @property cursor
     * @type {Cursor}
     */
    this.cursor = null;
};

//statics
/**
 * The hash of handlers for each channel subscribed to
 * @private
 * @static
 * @property SUBSCRIBERS
 * @type {Object}
 */
var SUBSCRIBERS = {};

/**
 * The collection that stores the commands
 * @private
 * @static
 * @property COMMAND_Q_COLL
 * @type {String}
 */
var COMMAND_Q_COLL = 'command_queue';

/**
 * Initializes the broker by creating the connections to Redis and registering
 * for the message event.
 * @method init
 * @param {Function} cb A callback that provides two parameters: cb(Error, Boolean)
 */
RedisCommandBroker.prototype.init = function(cb) {
    pb.log.debug('MongoCommandBroker: Initialized.');
    cb(null, true);
};

/**
 * Shuts down the broker by closing the open connections to Redis.
 * @method shutdown
 * @param {Function} cb A callback that provides two parameters: cb(Error, Boolean)
 */
RedisCommandBroker.prototype.shutdown = function(cb) {
    pb.log.debug('MongoCommandBroker: Shutting down...');
    //TODO implement
    cb(null, true);
};

/**
 * Called when a member of the cluster has published a command.  The function
 * inspects that it has a handler for the channel then delegates the command
 * back to the handler.
 * @method onCommandReceived
 * @param {String} channel The channel the message was pushed to
 * @param {String} commandStr The message that was published
 */
RedisCommandBroker.prototype.onCommandReceived = function(channel, command) {
    if (pb.log.isSilly()) {
        pb.log.silly('MongoCommandBroker: Command recieved [%s]%s', channel, JSON.stringify(command));
    }

    if (SUBSCRIBERS[channel]) {
        try{
            SUBSCRIBERS[channel](channel, command);
        }
        catch(err){
            pb.log.error('MongoCommandHandler: An error occurred while attempting to handoff the command [%s]%s. %s', channel, JSON.stringify(command), err.stack);
        }
    }
    else {
        pb.log.warn('MongoCommandBroker: A message was received for channel [%s] but no handler was available to accept it.', channel);
    }
};

/**
 * Sends a message to the specified channel
 * @method publish
 * @param {String} channel The channel to send the message to
 * @param {Object} command The command to send to the cluster
 * @param {Function} cb A callback that takes two parameters: cb(Error, 1 on success/FALSE on failure)
 */
RedisCommandBroker.prototype.publish = function(channel, command, cb) {
    if (!pb.utils.isObject(command)) {
        throw new Error('The channel string and command object are required!');
    }

    if (pb.log.isSilly()) {
        pb.log.silly('MongoCommandBroker: Sending command [%s]%s', channel, JSON.stringify(command));
    }
    
    //send command
    command.object_type = COMMAND_Q_COLL;
    command.channel     = channel;
    var dao = new pb.DAO();
    dao.save(command, function(err, result) {
        cb(err, result ? true : false);
    });
};

/**
 * Registers a handler for messages on the specified channel.
 * @method subscribe
 * @param {String} channel The channel to listen for messages on
 * @param {Function} onCommandReceived A handler function that takes two
 * arguments: onCommandReceived(channel, message) where channel is a string and
 * message is an object.
 * @param {Function} cb A callback that takes two parameters: cb(Error, [RESULT])
 */
RedisCommandBroker.prototype.subscribe = function(channel, onCommandReceived, cb) {
    if (!pb.validation.validateNonEmptyStr(channel, true) || !pb.utils.isFunction(onCommandReceived)) {
        cb(new Error('A valid channel string and handler function is required'));
        return;
    }

    //setup the one time subscribe callback
    pb.log.debug('MongoCommandBroker: Subcribing to channel [%s]', channel);
//    this.subscribeClient.once('subscribe', function(subscribedChannel, count) {
//        if (channel === subscribedChannel) {
//
//            SUBSCRIBERS[channel] = onCommandReceived;
//            cb(null, count);
//        }
//    });
//    this.subscribeClient.subscribe(channel);
    
    
    var self = this;
    var db = pb.dbm[pb.config.db.name];
    db.collection(COMMAND_Q_COLL, function(err, collection) {
        if (util.isError(err)) {
            return cb(err);
        }
 
        var latest = collection.find({}).sort({ $natural: -1 }).limit(1);
 
        latest.nextObject(function(err, doc) {
            if (util.isError(err)) {
                return cb(err);
            }
            console.log(err);
            var query = { created: { $gt: new Date() }};
            
            var options = { tailable: true, awaitdata: true, numberOfRetries: -1 };
            var cursor = collection.find(query, options).sort({ $natural: 1 });
 
            (function next() {
                cursor.nextObject(function(err, command) {
                    if (util.isError(err)) {
                        pb.log.error('MongoCommandBroker: Error while waiting for the next command: %s', err.stack);
                        return;
                    }
                    
                    console.log(command);
                    //self.onCommandReceived(command.channel, command);
                    next();
                });
            })();
            
            SUBSCRIBERS[channel] = onCommandReceived;
            cb(null, true);
        });
    });
};

//exports
module.exports = RedisCommandBroker;