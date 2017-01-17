import Animation from './Animation.js';
import animationStateManager from './animationStateManager.js';

    const renderByOffset = function (animationItem) {
        return animationItem.offset;
    };

    const renderByOffsetAndDuration = function (animationItem) {
        return animationItem.offset + animationItem.animation._duration;
    };

    export default class Timeline extends Animation {
        constructor(config){
            super(config);
            this._animationItems = new Map();
            this._iterationCount = 1;
            this._lastCurrentTime = 0;
        }

        calculateDuration () {
            return  Array.from(this._animationItems.values()).reduce(function (duration, animationItem) {
                let animationTotalDuration = animationItem.offset + animationItem.animation._duration;
                if (animationTotalDuration > duration) {
                    return animationTotalDuration;
                }
                return duration;
            }, 0);
        }

        add () {
            let animationItems = Array.prototype.slice.call(arguments, 0);
            let self = this;

            animationItems.forEach(function (animationItem) {
                if (typeof animationItem.offset !== "number") {
                    throw new Error("animationItem needs to have an offset property set.");
                }

                if (!(animationItem.animation instanceof Animation)) {
                    throw new Error("animationItem needs to have an animation property set thats an instanceof Animation.");
                }

                self._animationItems.set(animationItem, animationItem);
            });

            this._duration = this.calculateDuration();
        }

        remove (animationItem) {
            this._animationItems.delete(animationItem);
        }

        render () {
            let progress = this._progress;
            let timelineDuration = this._duration;
            let currentTime = progress * timelineDuration;
            let timeScale = this._timeScale;
            let now = Date.now();
            let currentState = this._currentState;

            let animationsItems = Array.from(this._animationItems.values());

            if (this._currentState === animationStateManager.reverseState ||
                this._currentState === animationStateManager.reversePausedState) {
                animationsItems.sort(function (a, b) {
                    // Order Desc
                    let aValue = renderByOffsetAndDuration(a);
                    let bValue = renderByOffsetAndDuration(b);
                    if (aValue === bValue) {
                        return 0;
                    } else if (aValue > bValue) {
                        return -1;
                    } else if (aValue < bValue) {
                        return 1;
                    }
                })
            } else {
                animationsItems.sort(function (a, b) {
                    // Order Asc
                    let aValue = renderByOffset(a);
                    let bValue = renderByOffset(b);
                    if (aValue === bValue) {
                        return 0;
                    } else if (aValue < bValue) {
                        return -1;
                    } else if (aValue > bValue) {
                        return 1;
                    }
                });
            }

            animationsItems.forEach(function (animationItem) {
                let duration = animationItem.animation._duration;
                let offset = animationItem.offset;
                let animation = animationItem.animation;

                if (currentState === animationStateManager.reverseState) {
                    animation._currentState = animationStateManager.reversePausedState;
                } else {
                    animation._currentState = animationStateManager.forwardPausedState;
                }

                animation.setTimeScale(timeScale);

                if (currentTime >= offset && currentTime <= offset + duration) {
                    let difference = currentTime - offset;
                    let animationProgress = difference / duration;

                    animation.seek(animationProgress, now);
                }

                if (currentTime > offset + duration && animation._progress !== 1) {
                    if (animation._progress < 1) {
                        animation.seek(1);
                        animation.stop();
                    } else {
                        animation.stop();
                        animation.seek(1);
                    }
                }

                if (currentTime < offset && animation._progress !== 0) {
                    if (animation._progress > 0) {
                        animation.seek(0);
                        animation.stop();
                    } else {
                        animation.stop();
                        animation.seek(0);
                    }
                }
            });
        }
    }
