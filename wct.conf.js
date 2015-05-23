'use strict';

module.exports = {
    verbose:           false,
    trackConsoleError: false,
    plugins:           {
        local: {
            browsers: []
        },
        sauce: {
            browsers:  [ 'OS X 10.10/chrome@dev', 'Linux/android@4.4' ],
            username:  process.env.SAUCE_USERNAME,
            accessKey: process.env.SAUCE_ACCESS_KEY
        }
    }
};
