import easings from './easings.js';
import AnimationManager from './AnimationManager.js';
import animationStateManager from './animationStateManager.js';

const makeTickPercentageObservers = function (observers) {
    for (let x = 0; x <= 100 ; x++) {
        observers[x] = [];
    }
};

const returnObserver = function (observer) {
    return observer;
};

class Observer {
    constructor(callback, unbind){
        this.stateManager = {
            stopped: {
                start: function (observer) {
                    observer._currentState = Observer.prototype.stateManager.started;
                    return observer;
                },
                stop: returnObserver,
                callback: returnObserver
            },
            started: {
                start: returnObserver,
                stop: function (observer) {
                    observer._currentState = Observer.prototype.stateManager.stopped;
                    return observer;
                },
                callback: function (observer, event) {
                    observer._callback(event);
                    return observer;
                }
            }
        };

        this._callback = callback;
        this._currentState = this.stateManager.started;
        this.unbind = unbind || function () { };
    }

    stop () {
        return this._currentState.stop(this);
    }

    start () {
        return this._currentState.start(this);
    }

    callback (event) {
        return this._currentState.callback(this, event);
    }

    dispose () {
        return this.unbind()
    }
}

export default class Animation {
    constructor(config) {
        config = config || {};

        this._target = config.target || {};
        this._currentTime = 0;
        this._timeScale = 1;
        this._duration = config.duration || 0.0001; // This is virtually zero.
        this._progress = 0;
        this._properties = config.properties || {};
        this._beginningValues = {};
        this._currentState = animationStateManager.stoppedState;

        this.iterations = 0;
        this.repeat = 1;
        this.repeatDirection = 0;

        this._observers = {
            play: [],
            stop: [],
            pause: [],
            restart: [],
            reverse: [],
            seek: [],
            tick: [],
            end: [],
            start: []
        };

        makeTickPercentageObservers(this._observers);

        if (typeof config.easing === "string") {
            this._easingFunction = easings[config.easing];
        } else if (typeof config.easing === "function") {
            this._easingFunction = config.easing;
        } else {
            this._easingFunction = easings.linear;
        }

        this.animationManager = new AnimationManager();

        this.playToEndAsync = this.playToEndAsync.bind(this);
        this.reverseToStartAsync = this.reverseToStartAsync.bind(this);
    }

    setAnimationManager (newAnimationManager) {
        let currentAnimationManager = this.animationManager;
        this.animationManager = newAnimationManager;

        currentAnimationManager._animations.forEach(function (animation) {
            currentAnimationManager.unregister(animation);
            newAnimationManager.register(animation);
        });
    }

    _saveBeginningValues () {
        let target = this._target;
        let beginningValues = this._beginningValues;
        let properties = this._properties;

        Object.keys(properties).forEach(function (property) {
            beginningValues[property] = target[property];
        });
    }

    play () {
        return this._currentState.play(this);
    }

    stop () {
        this._currentState.stop(this);
        return this;
    }

    observeAtTick (ratio, callback) {
        let percentage = ratio * 100;
        if (typeof percentage === "number" && percentage >= 0 && percentage <= 100) {
            percentage = parseInt(percentage);
            return this.observe(percentage.toString(), callback);
        }

        throw new Error("Invalid Argument Exception: percentage must be a decimal, and with in 0-1");
    }

    playToEndAsync (startAt) {
        if (typeof startAt === "number" && startAt >= 0 && startAt <= 1) {
            this._progress = startAt;
        }

        return this.playToPercentageAsync(100);
    }

    playToPercentageAsync (percentage) {
        let self = this;
        let ratio = percentage / 100;
        percentage = parseInt(percentage, 10);

        if (ratio < this._progress) {
            throw new Error("Cannot play to a point less than the current progress.");
        }

        if (typeof percentage !== "number" || percentage < 0 || percentage > 100) {
            throw new Error("Expected fraction to be a number within range (0-100).");
        }

        return new Promise(function (setValue, setError) {

            self.stop();

            const disposeAllObservers = function () {
                reverseObserver.dispose();
                endObserver.dispose();
                stopObserver.dispose();
                self.seek(self._progress).render();
            };

            const endObserver = self.observeAtTick(ratio, function () {
                disposeAllObservers();
                self.stop();
                setValue();
            });

            const stopObserver = self.observe("stop", function (event) {
                disposeAllObservers();
                canceled(event.type);
            });

            const reverseObserver = self.observe("reverse", function (event) {
                disposeAllObservers();
                canceled(event.type);
            });

            const canceled = function (reason) {
                if (reason !== "reverse") {
                    self.stop();
                }
                setError('canceled');
            }

            self.play();
        });
    }

    reverseToStartAsync (startAt) {
        if (typeof startAt === "number" && startAt >= 0 && startAt <= 1) {
            this._progress = startAt;
        }

        return this.reverseToPercentageAsync(0);
    }

    reverseToPercentageAsync (percentage) {
        let self = this;
        let ratio = percentage / 100;
        percentage = parseInt(percentage, 10);

        if (ratio > this._progress) {
            throw new Error("Cannot reverse to a point greater than the current progress.");
        }

        if (typeof percentage !== "number" || percentage < 0 || percentage > 100) {
            throw new Error("Expected fraction to be a number within range (0-100).");
        }

        return new Promise(function (setValue, setError) {
            self.stop();

            const disposeAllObservers = function () {
                playObserver.dispose();
                endObserver.dispose();
                stopObserver.dispose();
                self.seek(self._progress).render();
            };

            const endObserver = self.observeAtTick(ratio, function () {
                disposeAllObservers();
                self.stop();
                setValue();
            });

            const stopObserver = self.observe("stop", function (event) {
                disposeAllObservers();
                canceled(event.type);
            });

            const playObserver = self.observe("play", function (event) {
                disposeAllObservers();
                canceled(event.type);
            });

            const canceled = function (reason) {
                if (reason !== "play") {
                    this.stop();
                }
                setError('canceled')
            };

            self.reverse();
        });
    }

    pause () {
        return this._currentState.pause(this);
    }

    restart () {
        return this._currentState.restart(this);
    }

    reverse () {
        return this._currentState.reverse(this);
    }

    notify (event) {
        let type = event.type;
        if (Array.isArray(this._observers[type])) {
            this._observers[type].forEach(function (observer) {
                observer.callback(event);
            });
        }
    }

    tick (time) {
        let value = this._currentState.tick(this, time);
        return value;
    }

    invalidate () {
        this._progress = 0;
        this._currentState = animationStateManager.pausedState;
        return this;
    }

    getProgress () {
        return this._progress;
    }

    setTimeScale (timeScale) {
        this._timeScale = timeScale;
    }

    getTimeScale () {
        return this._timeScale;
    }

    seek (progressValue, now) {
        this._currentState.seek(this, progressValue, now);
        return this;
    }

    observe (type, callback) {
        if (typeof type !== "string") {
            throw new Error("Need to supply a type.");
        }

        let callbacks = this._observers[type];

        if (typeof callbacks === "undefined") {
            throw new Error("Unknown type to observe to. Here is a list of types to observe to: play, stop, pause, restart, reverse, seek, tick, end, start");
        }

        let observer = new Observer(callback, function () {
            let index = callbacks.indexOf(observer);
            if (index >= 0) {
                callbacks.splice(index, 1);
            }
        });

        callbacks.push(observer);

        return observer;
    }

    render () {
        let progress = this._progress;
        let beginningValues = this._beginningValues;
        let endingValues = this._properties;
        let duration = this._duration;
        let easingFunction = this._easingFunction;
        let target = this._target;
        let properties = this._properties;
        let beginningValue;
        let endingValue;
        let property;
        let value;

        for (property in properties) {
            //beginningValue, endingValue, currentTime, duration, easing
            beginningValue = beginningValues[property];
            endingValue = endingValues[property];

            if (typeof endingValue === "object" && endingValue !== null) {
                beginningValue = endingValue.from;
                endingValue = endingValue.to;
            }

            if (typeof beginningValue === "undefined") {
                beginningValues[property] = target[property];
                beginningValue = target[property];
            }

            if (typeof beginningValue !== "number" || typeof endingValue !== "number") {
                throw new Error("Default renderer is only able to animate integers. Set the renderer in the config to handle custom values.");
            }

            let change = endingValue - beginningValue;
            let currentTime = progress * duration;

            if (change !== 0) {
                value = easingFunction(currentTime, beginningValue, change, duration);
            } else {
                value = endingValue;
            }

            // This will be more optimal. Don't set the value unless it changes.
            if (target[property] !== value) {
                target[property] = value;
            }
        }

        return this;
    }
}
