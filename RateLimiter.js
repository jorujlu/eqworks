var moment = require("moment");
/* 
    Module which supports API Rate Limiting (Sliding Log Algorithm).
    @timeInterval - window size
    @numberOfCalls - max number of allowed requests in a given timeInterval
    @requestStorage - storage for user api calls, where key is the token which identifies the user, value is the information 
    about that users request which contains the list of requests (timestamp and number of available tokens at the point the request has been pushed to the list),
    window start time, and the position of the first request after the window start time (in order to avoid looping through the whole array everytime). 
*/
class RateLimiter {

    constructor(timeInterval, numberOfCalls) {
        this.timeInterval = timeInterval;
        this.numberOfCalls = numberOfCalls;
        this.requestStorage = new Object();
    }

    /*
        appendNewRequest - adds the new incoming request to request storage specific for the user only if the user has available requests for that window. 
    */
    appendNewRequest(timestamp, token) {
        if (this.requestStorage.hasOwnProperty(token)) {
            // If the user has available tokens just push the request to the storage
            if (this.getNumberOfAvailableTokens(token) > 0) {
                let userRequestList = this.requestStorage[token].listOfRequests;
                let newNumberOfAvailableTokens = userRequestList[userRequestList.length - 1].numberOfAvailableTokens - 1;
                userRequestList.push({
                    "timestamp": timestamp,
                    "numberOfAvailableTokens": newNumberOfAvailableTokens
                });
                return true;
            } else if (this.getTimeDifference(token, timestamp) > this.timeInterval) { // If the user does not have available tokens check if the window should slide and new tokens can be added
                let userInfo = this.requestStorage[token];
                let userRequestList = userInfo.listOfRequests;
                let nextWindowStartTime = moment(timestamp).subtract(this.timeInterval, "minutes").toDate();
                userInfo.windowStartTime = nextWindowStartTime;
                let numOfDroppedRequests = this.findNextFirstRequestIndex(userInfo);
                if (numOfDroppedRequests > 0) {
                    let newNumberOfAvailableTokens = Math.min(userRequestList[userRequestList.length - 1].numberOfAvailableTokens + numOfDroppedRequests - 1, 4);
                    userInfo.listOfRequests.push({
                        "timestamp": timestamp,
                        "numberOfAvailableTokens": newNumberOfAvailableTokens
                    });
                    return true;
                }
                return false;
            } else {
                return false;
            }
        } else { // If the user first time makes a request create a new token in the Storage
            this.requestStorage[token] = {
                "windowStartTime": timestamp,
                "firstRequestAfterWindowStartTime": 0,
                "listOfRequests": [
                    {
                        "timestamp": timestamp,
                        "numberOfAvailableTokens": 4
                    }
                ]
            };
            return true;
        }
    }

    /*
        finfNextFirstRequestIndex - when windows slides, shifts first requests position after window start time. 
    */
    findNextFirstRequestIndex(userInfo) {
        let windowStartTime = userInfo.windowStartTime;
        let listOfRequests = userInfo.listOfRequests;
        var index = userInfo.firstRequestAfterWindowStartTime;
        var count = 0;
        var startTime = moment(windowStartTime);
        var i;
        for (i = index; i < listOfRequests.length; i++) {
            let timestamp = moment(listOfRequests[i].timestamp);
            if (startTime <= timestamp) {
                userInfo.firstRequestAfterWindowStartTime = index;
                return count;
            } else {
                if (i == listOfRequests.length - 1) {
                    userInfo.firstRequestAfterWindowStartTime = index + 1;
                    count += 1;
                    return count;
                } else {
                    count += 1;
                    index += 1;
                }

            }
        }
        
    }
    
    /*
        getNumberOfAvailableTokens - checks how many tokens user still have for current window
    */
    getNumberOfAvailableTokens(token) {
        let userInfoFromStorage = this.requestStorage[token];
        let listOfRequests = userInfoFromStorage.listOfRequests;
        return listOfRequests[listOfRequests.length - 1].numberOfAvailableTokens;
    }

    /*
        getTimeDifference - calculates time difference between last request's time and last window start time
    */
    getTimeDifference(token, timestamp) {
        var userInfoFromStorage = this.requestStorage[token];
        let windowStartTime = userInfoFromStorage.windowStartTime;
        let duration = moment.duration(moment(timestamp).diff(windowStartTime));
        return duration.asMinutes();
    }
}

module.exports.RateLimiter = RateLimiter;
