/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/


This is a sample Slack bot built with Botkit.

This bot demonstrates many of the core features of Botkit:

* Connect to Slack using the real time API
* Receive messages based on "spoken" patterns
* Reply to messages
* Use the conversation system to ask questions
* Use the built in storage system to store and retrieve information
  for a user.

# RUN THE BOT:

  Get a Bot token from Slack:

    -> http://my.slack.com/services/new/bot

  Run your bot from the command line:

    token=<MY TOKEN> node slack_bot.js

# USE THE BOT:

  Find your bot inside Slack to send it a direct message.

  Say: "Hello"

  The bot will reply "Hello!"

  Say: "who are you?"

  The bot will tell you its name, where it is running, and for how long.

  Say: "Call me <nickname>"

  Tell the bot your nickname. Now you are friends.

  Say: "who am I?"

  The bot will tell you your nickname, if it knows one for you.

  Say: "shutdown"

  The bot will ask if you are sure, and then shut itself down.

  Make sure to invite your bot into other channels using /invite @<my bot>!

# EXTEND THE BOT:

  Botkit has many features for building cool and useful bots!

  Read all about it here:

    -> http://howdy.ai/botkit

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/


if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('../lib/Botkit.js');
var os = require('os');
var request = require("request");
var dbConnector = require('./db_connector.js');

var controller = Botkit.slackbot({
    debug: true,
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM();

var global_users = { /*'U7N256YMU': 'Anton' */ 'U7M5DH64A': 'Olive', 'U7LKX79G9': 'Manvi', 'U7M5G9E3U': 'Thomas' };

var tasks = [];

controller.hears(['^report$'] , 'direct_message,direct_mention', function(bot, message) {
    bot.api.conversations.open({ users: 'U7N256YMU' , return_im: true}, function(err, res) {
        message = {type: 'message' , user: res.channel.user , channel: res.channel.id}
        body = "Hey here is a summary of the tasks:\n"
        tasks.forEach(function(task){
            body += task.status + ' "' + task.task.description + '" assigned to '+ ( global_users[task.user.id] || task.user.id) + "\n"
        });
        bot.reply(message, { text: body });
    });
});

controller.hears(['^reminder$'], 'direct_message,direct_mention', function(bot, message) {
    Object.keys(global_users).forEach(function (el) {
        bot.api.conversations.open({ users: el, return_im: true }
        , function (err, res) {

            bot.reply({type: 'message', user: res.channel.user, channel: res.channel.id}, {
                "attachments": [
                    {
                        "fallback": "Pleading kitten",
                        "image_url": "http://38.media.tumblr.com/d42f40555947c0b955ffbfc6f73fe8ce/tumblr_nwn2jnP3Pl1ucw7ggo1_400.gif"
                    }
                ]
            });

            bot.startConversation({type: 'message', user: res.channel.user, channel: res.channel.id}, function (err, convo) {
                convo.task.timeLimit = 10000
                convo.ask('*Hello ' + global_users[el] +  ', it is time for your report ! Do you want to enter your tasks ?*'
                , [
                {
                    pattern: 'yes',
                    callback: function(response, convo) {
                        convo.next()
                    }
                },
                {
                    pattern: 'no',
                    callback: function(response, convo) {
                        convo.stop()
                    }
                },
                {
                    pattern: 'snooze',
                    callback: function(response, convo) {
                        convo.stop()
                    }
                },
                {
                    default: true,
                    callback: function(response, convo) {
                        convo.repeat();
                        convo.next();
                    }
                }]);

                convo.on('end', function(convo) {
                    if (convo.status == 'completed') {
                        bot.reply({type: 'message', user: res.channel.user, channel: res.channel.id}, 'Great ! Please go ahead.');
                        bot.reply({type: 'message', user: res.channel.user, channel: res.channel.id}, 'Usage:\n```\ntodo <task>\ndoing <task>\ndone <task>\nlist```')
                    } else {
                        // this happens if the conversation ended prematurely for some reason
                        bot.reply({type: 'message', user: res.channel.user, channel: res.channel.id}, 'OK, i\'ll remind you later!');
                    }
                });
            });
        });
    });
});

controller.hears(['^knock knock$'], 'direct_message,direct_mention,mention' , function(bot, message) {
    bot.startConversation(
        message
        , function(err, convo) {
            convo.ask( 'knock knock who?'
                , function(res, convo) {
                convo.say(res.text + ' pawhpwahphaw!')
                convo.next()
            });
    });
 });

controller.hears(['what is my name', 'who am i'], 'direct_message,direct_mention,mention', function (bot, message) {

    controller.storage.users.get(message.user, function (err, user) {
        if (user && user.name) {
            bot.reply(message, 'Your name is ' + user.name);
        } else {
            bot.startConversation(message, function (err, convo) {
                if (!err) {
                    convo.say('I do not know your name yet!');
                    convo.ask('What should I call you?', function (response, convo) {
                        convo.ask('You want me to call you `' + response.text + '`?', [
                            {
                                pattern: 'yes',
                                callback: function (response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function (response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function (response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);

                        convo.next();

                    }, { 'key': 'nickname' }); // store the results in a field called nickname

                    convo.on('end', function (convo) {
                        if (convo.status == 'completed') {
                            bot.reply(message, 'OK! I will update my dossier...');

                            controller.storage.users.get(message.user, function (err, user) {
                                if (!user) {
                                    user = {
                                        id: message.user,
                                    };
                                }
                                user.name = convo.extractResponse('nickname');
                                controller.storage.users.save(user, function (err, id) {
                                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                                });
                            });



                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        }
    });
});

var tasks = [];

function getStatus(message){
    if(message.includes("done") || message.includes("finished")){
        return "done";
    } else if(message.includes("pending") || message.includes("ongoing") || message.includes("doing")){
        return "doing";
    } else {
        return "todo";
    }
}

// Save/Update task to storage
controller.hears(['done (.*)', 'finished (.*)', 'pending (.*)', 'ongoing (.*)', 
    'doing (.*)', 'todo (.*)', 'to do (.*)', 'next (.*)'], 'direct_message,direct_mention,mention', function (bot, message) {
    var key = message.match[1];
    var task = {};

    // Check if task is in storage
    var oldTask = tasks.filter(p => (p.task.id == key || p.task.description == key));

    if (oldTask.length == 0) {
        // If it doesnt exist
        // Generate  5-char random string ID
        task.id = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5).toUpperCase();

        // Save the new task details
        task.description = message.match[1];
        task.user = message.user;
    } else {
        task = oldTask[0];
    }

    // Update date and status part
    task.date = message.ts;

    // Status is the first word of the sentence
    task.status = getStatus(message.text);

    // Only save to storage if it is new
    if (oldTask.length == 0) {
        // TODO: Replace this with save to storage
        tasks.push(task);
        dbConnector('mongodb://localhost:27017/slackdb', function(worker){
            worker.insert(new Date(), { id: task.id, description: task.description}, 
                task.status, { id: message.user, name: message.user});
        });
    } else {
        // TODO: Update item in storage
        dbConnector('mongodb://localhost:27017/slackdb', function(worker){
            console.log(oldTask);
            worker.updateStatus(oldTask[0].task.id, task.status);
        });
    }

    bot.reply(message, 'Got it. We saved: \n```\n' + JSON.stringify(task, null, 2) + '\n```');
});

function getMonday(d)
{
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay() + 1);
}

function getFriday(d)
{
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay() + 5);
}

controller.hears(['start', 'get', 'list'], 'direct_message,direct_mention,mention', function (bot, message) {
    // TODO: Replace this with getting from storage
    dbConnector('mongodb://localhost:27017/slackdb', function(worker){
        
        worker.findByDateRange(getMonday(new Date()), getFriday(new Date()), message.user, function(data){
            if (data.length > 0) {
                tasks = data;
                var str = '';
                var result = groupBy(data, 'status');
                Object.keys(result).forEach(function(key){
                    str += key;
                  str += '\n';
                  result[key].forEach(function(item){
                      str += '\t' + item.task.description + '\n';
                  });
                });
                console.log(str);
                bot.reply(message, 'Your tasks for this week: \n```\n' + str + '\n```');
            } else {
                bot.reply(message, 'No tasks ');
            }
        });
    });
});

controller.hears(['today'], 'direct_message,direct_mention,mention', function (bot, message) {
    // TODO: Replace this with getting from storage
    dbConnector('mongodb://localhost:27017/slackdb', function(worker){
        
        worker.findByDate(new Date(), message.user, function(data){
            if (data.length > 0) {
                tasks = data;
                var str = '';
                var result = groupBy(data, 'status');
                Object.keys(result).forEach(function(key){
                    str += key;
                  str += '\n';
                  result[key].forEach(function(item){
                      str += '\t' + item.task.description + '\n';
                  });
                });
                console.log(str);
                bot.reply(message, 'Your tasks for today: \n```\n' + str + '\n```');
            } else {
                bot.reply(message, 'No tasks ');
            }
        });
    });
});

var groupBy = function(xs, key) {
    return xs.reduce(function(rv, x) {
      (rv[x[key]] = rv[x[key]] || []).push(x);
      return rv;
    }, {});
  };

function formatReport(tasks){
    // FORMATS THE REPORT BASED ON STATUS
    var body = "Hey here is a summary of all the tasks per user:\n"
    tasks.forEach(function(task){
        body += task.status + ' "' + task.task.description + '" assigned to '+ ( global_users[task.user.id] || task.user.id) + "\n"
    });

    return body;
}

controller.hears(['clear'], 'direct_message,direct_mention,mention', function (bot, message) {
    // TODO: Replace this with clearing the storage
    tasks = [];
    bot.reply(message, 'Tasks are cleared.');
});

controller.hears(['gif me', 'gif me up', 'puppy', 'puppy power'], 'direct_message,direct_mention,mention', function (bot, message) {
    request("http://api.giphy.com/v1/gifs/search?q=puppy&api_key=dc6zaTOxFJmzC", function (error, response, body){
        var data = JSON.parse(body);
  
        var max = data.data.length;
        var min = 0;
  
        var randomNumber = Math.floor(Math.random() * (max - min)) + min;
  
        gifUrl = data.data[randomNumber].images.downsized.url;
  
        replyMessage = "Here's a puppy!!! \n" + gifUrl;
  
        bot.reply(message, replyMessage);
      });
});

controller.hears(['meow'], 'direct_message,direct_mention,mention', function (bot, message) {
    request("http://api.giphy.com/v1/gifs/search?q=kitten&api_key=dc6zaTOxFJmzC", function (error, response, body){
        var data = JSON.parse(body);
  
        var max = data.data.length;
        var min = 0;
  
        var randomNumber = Math.floor(Math.random() * (max - min)) + min;
  
        gifUrl = data.data[randomNumber].images.downsized.url;
  
        replyMessage = "Here's a kitten!!! \n" + gifUrl;
  
        bot.reply(message, replyMessage);
      });
});

controller.hears(['^shutdown$'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.startConversation(message, function (err, convo) {

        convo.ask('Are you sure you want me to shutdown?', [
            {
                pattern: bot.utterances.yes,
                callback: function (response, convo) {
                    convo.say('Bye!');
                    convo.next();
                    setTimeout(function () {
                        process.exit();
                    }, 3000);
                }
            },
            {
                pattern: bot.utterances.no,
                default: true,
                callback: function (response, convo) {
                    convo.say('*Phew!*');
                    convo.next();
                }
            }
        ]);
    });
});

controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', function (bot, message) {

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'cat',
    }, function (err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    });


    controller.storage.users.get(message.user, function (err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '!!');
        } else {
            bot.reply(message, 'Hello.');
        }
    });
});

controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function (bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function (err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user, function (err, id) {
            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

controller.hears(['^beer$'], 'direct_message,direct_mention,mention' , function(bot, message) {
    bot.startConversation(
        message
        , function(err, convo) {
            convo.ask( 'Beer is not the question , Beer is the answer!'
                , function(res, convo) {
                convo.say('paw-5!')
                convo.next()
            });
    });
 });

controller.hears(['^coffee$'], 'direct_message,direct_mention,mention' , function(bot, message) {
    bot.startConversation(
        message
        , function(err, convo) {
            convo.ask( 'How are you feeling today?'
                , function(res, convo) {
                convo.say(res.text + ' pawsome!')
                convo.next()
            });
    });
});

controller.hears( ['^spaghetti$'] , 'direct_message,direct_mention,mention', function(bot, message) {
	bot.whisper(message, 'I may be a humble App, but I too love a good noodle');
});

controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function (bot, message) {

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
            '>. I have been running for ' + uptime + ' on ' + hostname + '.');

    });

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}