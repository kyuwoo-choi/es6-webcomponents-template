'use strict';

module.exports = {
    verbose: false,
    plugins: {
        local: {
            browsers: ['chrome']
        },
        sauce: {
            browsers:  [ 'OS X 10.10/chrome@dev', 'Linux/android@4.3', 'Linux/android@4.4' ],
            username:  process.env.SAUCE_USERNAME,
            accessKey: process.env.SAUCE_ACCESS_KEY
        }
    }
};
