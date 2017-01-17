export default class AnimationManager {
    constructor(timer){
        this._currentRequesetAnimationFrame = null;
        this._animations = [];
        this._lastTime = 0;
        this._fps = 100;
        this._refreshRateInMilliseconds = 1000 / this._fps;
        this._timer = timer || Date;

        this._requestCallback = function () {
            this.tick(this._timer.now());
        };
        this._requestCallback = this._requestCallback.bind(this);
        this.setFramesPerSecond(this._fps);
    }

    setFramesPerSecond (fps) {
        this._fps = fps;
        this._refreshRateInMilliseconds = 1000 / fps;
    }

    getFramesPerSecond () {
        return this._fps;
    }

    checkRequestToStartOrStop () {
        let animations = this._animations;
        if (this._currentRequesetAnimationFrame === null && animations.length > 0) {
            this._currentRequesetAnimationFrame = requestAnimationFrame(this._requestCallback);
        }
    }

    tick (time) {
        let animationsCopy;
        let animations = this._animations;
        let length = animations.length;

        let elapsedTime = time - this._lastTime;

        // Throttle this to be the specified frames per second.
        if (elapsedTime >= this._refreshRateInMilliseconds) {
            this._lastTime = time;

            if (length > 0) {
                animationsCopy = animations.slice(0);

                animationsCopy.forEach(function (animation) {
                    animation.tick(time);
                });

                this._currentRequesetAnimationFrame = requestAnimationFrame(this._requestCallback);

            } else {
                this._currentRequesetAnimationFrame = null;
            }
        } else {
            this._currentRequesetAnimationFrame = requestAnimationFrame(this._requestCallback);
        }
    }

    now () {
        return this._timer.now();
    }

    register (animation) {
        let index = this._animations.indexOf(animation);
        if (index === -1) {
            this._animations.push(animation);
            this.checkRequestToStartOrStop();
        }
    }

    unregister (animation) {
        let index = this._animations.indexOf(animation);
        if (index >= 0) {
            this._animations.splice(index, 1);
        }
    }
}
