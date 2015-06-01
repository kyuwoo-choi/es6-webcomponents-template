'use strict';

var os = require('os');
var fs = require('fs');
var ifaces = os.networkInterfaces();
var path = require('path');
var proc = require('child_process')
var Q = require('q');
var chalk = require('chalk');
var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var runSequence = require('run-sequence');
var browserSync = require('browser-sync').create();
var reload = browserSync.reload;
require('web-component-tester').gulp.init(gulp);
var cordova = require('cordova-lib').cordova.raw; // promises API
var cordovaConfig = require('cordova-lib/src/configparser/ConfigParser');
var et = require('cordova-lib/node_modules/elementtree');
var electronPackager = require('electron-packager');
var packageJson = require('./package.json');
var appConfig = require('./appconfig.json');
var argv = require('yargs')
    .version(function() {
        return packageJson.version;
    })
    .command('default', 'build www application. and serve on localhost over http')
    .command('clean', 'clean temp, dist, bin directories')
    .command('build:www', 'build www application.')
    .command('build:cordova', 'build cordova application. requires --cordovaPlatform')
    .command('build:electron', 'build cordova application. requires --electronPlatform')
    .command('emulate:cordova', 'run cordova application on specified platform using emulator. requires --cordovaPlatform')
    .command('run:cordova', 'run cordova application on specified platform. requires --cordovaPlatform')
    .command('run:electron', 'run electron application on this platform.')
    .command('serve:www', 'run application on browser and watch.')
    .command('serve:cordova', 'run cordova application on specified platform and watch. requires --cordovaPlatform')
    .command('serve:electron', 'run electron application on this platform and watch.')
    .usage('Usage: $0 <command> [option]')
    .help('help')
    .alias('help', 'h')
    .options({
        'cordovaPlatform': {
            alias: 'cp',
            description: 'cordova platform. [android|ios]'
        },
        'electronPlatform': {
            alias: 'ep',
            description: 'electron platform. [linux|win32|darwin]'
        },
        'electronArch': {
            alias: 'ea',
            description: 'electron architecture. [ia32|x64]'
        },
        'srcDir': {
            description: 'www source directory',
            default: 'src'
        },
        'tempDir': {
            description: 'www temp build directory',
            default: '.temp'
        },
        'distDir': {
            description: 'www distribution directory',
            default: 'dist'
        },
        'testDir': {
            description: 'unit test spec directory',
            default: 'test'
        },
        'binDir': {
            description: 'cordova/electron binary directory',
            default: 'bin'
        },
        'index': {
            description: 'index html file',
            default: 'index.html'
        },
        'env': {
            description: 'compile env [development|production]',
            default: 'development'
        },
        'transpiler': {
            description: 'es6 transpiler [traceur|babel]',
            default: 'traceur'
        },
        'minifyHtml': {
            description: 'minifies html',
            type: 'boolean'
        },
        'minifyScript': {
            description: 'minifies script',
            type: 'boolean'
        },
        'minifyCss': {
            description: 'minifies css',
            type: 'boolean'
        },
        'minify': {
            alias: 'm',
            description: 'minifies html/script/css',
            type: 'boolean'
        },
        'inlineScript': {
            description: 'inlines script',
            type: 'boolean'
        },
        'inlineCss': {
            description: 'inlines css',
            type: 'boolean'
        },
        'inline': {
            alias: 'i',
            description: 'inlines script/css',
            type: 'boolean'
        },
        'generateSourceMap': {
            description: 'generate source maps for script/css',
            type: 'boolean'
        },
        'name': {
            description: 'binary application name'
        },
        'version': {
            description: 'binary application version'
        },
        'packageName': {
            description: 'binary package name for cordova/electron'
        },
        'helperPackageName': {
            description: 'binary helper package name for electron'
        }
    })
    .example('$0 [default]', 'build www resources and serve http')
    .example('$0 build:cordova --cp android', 'build android application')
    .example('$0 build:cordova --cp ios', 'build iphone/ipad application')
    .example('$0 build:electron --ep darwin --ea x64', 'build osx 64bit application')
    .example('$0 build:electron --ep win32 --ea ia32', 'build windows 32bit application')
    .example('$0 build:electron --ep win32 --ea x64', 'build windows 64bit application')
    .example('$0 build:electron --ep linux --ea ia32', 'build linux 32bit application')
    .example('$0 build:electron --ep linux --ea x64', 'build linux 64bit application')
    .example('$0 build:www -im', 'build www resources with minifying/inlining')
    .example('$0 build:www --env production', 'build www resources with production mode')
    .example('$0 run:cordova --cp android', 'run android cordova application on device')
    .example('$0 serve:cordova --cp ios', 'run ios cordova application on device and watch')
    .example('$0 run:electron', 'run electron application on this platform')
    .example('$0 serve:electron', 'run electron application on this platform and watch')
    .argv;

var opt = {};
opt.srcDir = argv.srcDir;
opt.componentDir = argv.componentDir || 'component';
opt.tempDir = argv.tempDir;
opt.distDir = argv.distDir;
opt.testDir = argv.testDir;
opt.binDir = argv.binDir;
opt.indexFile = argv.index;
opt.remoteIndex = argv.remoteIndex;
opt.compileEnv = argv.env; //'development' || 'production'
opt.transpiler = argv.transpiler; //'babel' || 'traceur'
opt.minifyHtml = argv.minifyHtml || argv.minify || (opt.compileEnv === 'production');
opt.minifyScript = argv.minifyScript || argv.minify || (opt.compileEnv === 'production');
opt.minifyCss = argv.minifyCss || argv.minify || (opt.compileEnv === 'production');
opt.inlineScript = argv.inlineScript || argv.inline || (opt.compileEnv === 'production');
opt.inlineCss = argv.inlineCss || argv.inline || (opt.compileEnv === 'production');
opt.generateSourceMap = argv.generateSourceMap || (opt.compileEnv === 'development');
opt.excludeVulcanize = argv.excludeVulcanize || [ path.join('bower_components', 'webcomponentsjs') ];
//TODO vulcanize inlineScript breaks in some cases. https://github.com/Polymer/vulcanize/issues/113
opt.cordovaPlugins = argv.cordovaPlugins || appConfig.cordova.plugins ||  [];
opt.cordovaPlatform = argv.cordovaPlatform || 'android'; //android || ios
opt.electronPlatform = argv.electronPlatform || process.platform; //linux || win32 || darwin
opt.electronArch = argv.electronArch || process.arch; //ia32 || x64
opt.electronVersion = argv.electronVersion || appConfig.electron.version || '0.26.1';
opt.packageName = argv.packageName || appConfig[ 'app-bundle-id' ] || 'com.example';
opt.helperPackageName = argv.helperPackageName || appConfig[ 'helper-bundle-id' ] || 'com.example.helper';
opt.name = argv.name || appConfig[ 'name' ] || packageJson.name || 'test';
opt.version = argv.version || appConfig[ 'app-version' ] || packageJson.version || '0.0.1';


(function verbose (enabledChalk, disabledChalk) {
    function write (key, value) {
        console.log((value ? enabledChalk(key + value) : disabledChalk(key + value)));
    }
    write('BINARY CONFIG :           ', './appconfig.json');
    write('INDEX :                   ', opt.indexFile);
    write('SRC DIR :                 ', opt.srcDir);
    write('TEMP DIR :                ', opt.tempDir);
    write('DIST DIR :                ', opt.distDir);
    write('TEST DIR :                ', opt.testDir);
    write('BIN DIR :                 ', opt.binDir);
    write('ENV :                     ', opt.compileEnv);
    write('TRANSPILER :              ', opt.transpiler);
    write('INLINE SCRIPT :           ', opt.inlineScript);
    write('INLINE CSS :              ', opt.inlineCss);
    write('MINIFY HTML :             ', opt.minifyHtml);
    write('MINIFY SCRIPT :           ', opt.minifyScript);
    write('MINIFY CSS :              ', opt.minifyCss);
    write('GENERATE SOURCEMAP :      ', opt.generateSourceMap);
    write('EXCLUDE VULCANIZE :       ', opt.excludeVulcanize);
    write('NAME :                    ', opt.name);
    write('VERSION :                 ', opt.version);
    write('PACKAGE NAME :            ', opt.packageName);
    write('CORDOVA PLATFORM :        ', opt.cordovaPlatform);
    write('CORDOVA PLUGINS :         ', opt.cordovaPlugins);
    write('CORDOVA VERSION :         ', packageJson.devDependencies[ 'cordova-lib' ]);
    write('CORDOVA ANDROID VERSION : ', packageJson.devDependencies[ 'cordova-android' ]);
    write('CORDOVA IOS VERSION :     ', packageJson.devDependencies[ 'cordova-ios' ]);
    write('ELECTRON PLATFORM :       ', opt.electronPlatform);
    write('ELECTRON ARCH :           ', opt.electronArch);
    write('ELECTRON VERSION :        ', opt.electronVersion);
})(chalk.green, chalk.gray);



/**
 * CLEAN:WWW
 */
gulp.task('clean:www', function () {
    return gulp.src([ opt.tempDir, opt.distDir ], { read: false })
        .pipe($.plumber())
        .pipe($.clean());
});


/**
 * CLEAN:ELECTRON
 */
gulp.task('clean:electron', function () {
    return gulp.src([ path.join(opt.binDir, 'electron', opt.electronPlatform + '_' + opt.electronArch) ], { read: false })
        .pipe($.plumber())
        .pipe($.clean());
});


/**
 * CLEAN:CORDOVA
 */
gulp.task('clean:cordova', function () {
    return gulp.src([ path.join(opt.binDir, 'cordova') ], { read: false })
        .pipe($.plumber())
        .pipe($.clean());
});


/**
 * CLEAN:ALL
 */
gulp.task('clean:all', function (callback) {
    runSequence([ 'clean:www', 'clean:cordova', 'clean:electron'], callback);
});


/**
 * PREPARE:HTML
 */
gulp.task('prepare:html', function () {
    var injectFiles = [ path.join(opt.srcDir, 'bower_components', 'webcomponentsjs', 'webcomponents.js') ];
    if (opt.transpiler === 'traceur') {
        injectFiles.push(path.join(opt.srcDir, 'bower_components', 'traceur-runtime', 'traceur-runtime.js'));
    }
    return gulp.src(opt.srcDir + '/**/*.html')
        .pipe($.plumber())
        .pipe($.inject(gulp.src(injectFiles, { read: false }), {
            relative: true,
            transform: function (filepath) {
                //inject file path rewrite.
                arguments[ 0 ] = path.relative(path.resolve(opt.srcDir), path.resolve(opt.srcDir, filepath));
                return $.inject.transform.apply($.inject.transform, arguments);
            }
        }))
        .pipe(gulp.dest(opt.tempDir));
});


/**
 * PREPARE:JS
 */
gulp.task('prepare:js', function () {
    //TODO minifying bower_components js needed
});


/**
 * PREPARE:RESOURCE
 */
gulp.task('prepare:resource', function () {
    var excludeHtmlJsCssFilter = $.filter([ '**', '!**/*.html', '!**/*.js', '!**/*.css', '!bower_components/**', '!bower.json' ]);
    var excludeFolderFilter = $.filter(function (file) {
        return file.stat.isFile();
    });
    return gulp.src(opt.srcDir + '/**')
        .pipe($.plumber())
        .pipe(excludeHtmlJsCssFilter)
        .pipe(excludeFolderFilter)
        .pipe(gulp.dest(opt.tempDir))
        .pipe(gulp.dest(opt.distDir))
        .pipe(excludeFolderFilter.restore())
        .pipe(excludeHtmlJsCssFilter.restore());
});




/**
 * BUILD:HTML
 */
gulp.task('build:html', [ 'prepare:html' ], function () {
    return gulp.src(opt.tempDir + '/*.html')
        .pipe($.plumber())
        .pipe($.vulcanize({
            implicitStrip: false,
            excludes: opt.excludeVulcanize,
            inlineScripts: opt.inlineScript,
            inlineCss:     opt.inlineCss
        }))
        .pipe($.htmlMinifier({
            removeComments:     opt.minifyHtml,
            collapseWhitespace: opt.minifyHtml,
            preserveLineBreaks: !opt.minifyHtml,
            minifyJS:           opt.minifyScript,
            minifyCSS:          opt.minifyCss
        }))
        .pipe(gulp.dest(opt.distDir));
});


/**
 * BUILD:JS
 */
gulp.task('build:js', [ 'prepare:js' ], function () {
    var transpileFilter = $.filter([ '**/*.js', '!bower_components/**/*.js' ]);
    var browserifyFilter = $.filter([ '**/*.js', '!bower_components/**/*.js', '!js/lib/**/*.js' ]);
    var bowerComponentsFilter = $.filter([ '**/*.js', '!bower_components/**/*.js' ]);
    var excludedVulcanizeGlobs = [];
    for (var i = 0; i < opt.excludeVulcanize.length; i += 1) {
        excludedVulcanizeGlobs.push(opt.excludeVulcanize[i] + '/**/*.js')
        excludedVulcanizeGlobs.push( '!' + opt.excludeVulcanize[i] + '/**/*.min.js')
    }
    var excludedVulcanizeFilter = $.filter(excludedVulcanizeGlobs);

    return gulp.src(opt.srcDir + '/**/*.js')
        .pipe($.plumber())
        .pipe(bowerComponentsFilter)
        .pipe($.eslint())
        .pipe($.eslint.format())
        .pipe(bowerComponentsFilter.restore())
        .pipe($.if(opt.generateSourceMap, $.sourcemaps.init({ loadMaps: true })))
        .pipe(transpileFilter)
        .pipe($.if(opt.transpiler === 'babel', $.babel()))
        .pipe($.if(opt.transpiler === 'traceur', $.traceur()))
        .pipe(transpileFilter.restore())
        .pipe(browserifyFilter)
        .pipe($.browserify())
        .pipe(browserifyFilter.restore())
        .pipe($.if(opt.minifyScript, $.uglify()))
        .pipe($.if(opt.generateSourceMap, $.sourcemaps.write('.', {
            sourceRoot: '.'
        })))
        .pipe(gulp.dest(opt.tempDir))
        .pipe(excludedVulcanizeFilter) //copy to dist if it isn't vulcanized script.
        .pipe(gulp.dest(opt.distDir))
        .pipe(excludedVulcanizeFilter.restore())
        .pipe($.if((!opt.inlineScript), gulp.dest(opt.distDir)));
});


/**
 * BUILD:CSS
 */
gulp.task('build:css', function () {
    return gulp.src(opt.srcDir + '/**/*.css')
        .pipe($.plumber())
        .pipe($.if(opt.minifyCss && opt.generateSourceMap, $.sourcemaps.init({ loadMaps: true })))
        .pipe($.if(opt.minifyCss, $.minifyCss()))
        .pipe($.if(opt.minifyCss && opt.generateSourceMap, $.sourcemaps.write('.', {
            sourceRoot: '.'
        })))
        .pipe(gulp.dest(opt.tempDir))
        .pipe($.if((!opt.inlineCss), gulp.dest(opt.distDir)));
});


/**
 * BUILD:WWW
 */
gulp.task('build:www', [ 'clean:www' ], function (callback) {
    runSequence([ 'prepare:resource', 'build:js', 'build:css' ], 'build:html', 'test:local', callback);
});


/*
 * SERVE
 */
gulp.task('serve:www', function (callback) {
    var watchList = [ opt.distDir + '/*', opt.distDir + '/component/**', opt.distDir + '/js/**', opt.testDir + '/**' ];

    browserSync.init({
        startPath: opt.indexFile,
        server: {
            baseDir: opt.distDir
        }
    }, function (err, syncRet) {
        opt.remoteIndex = syncRet.options.get('urls').get('external');

        gulp.watch(watchList).on('change', reload);

        gulp.watch(opt.srcDir + '/**/*.css', [ 'build:css' ]);
        gulp.watch(opt.srcDir + '/**/*.js', [ 'build:js' ]);
        gulp.watch(opt.srcDir + '/**/*.html', [ 'build:html' ]);
        callback();
    });
});



/**
 * PREPARE:CORDOVA
 */
gulp.task('prepare:cordova', [ 'clean:cordova' ], function (callback) {
    var cfg = {
        id: opt.packageName, //packagename
        name: opt.name, //name
        lib: {
            www: {
                uri: path.resolve(opt.distDir),
                url: path.resolve(opt.distDir),
                link: true,
                version: opt.version,
                id: opt.packageName
            }
        }
    };
    var cwd = process.cwd();
    cordova.create(path.join(opt.binDir, 'cordova'), opt.packageName, opt.name, cfg)
        .then(function () {
            //check task if it is serve. then replace
            if (argv['_'][0].split(':')[0] === 'serve') {
                var cordovaCfg = new cordovaConfig(path.join(path.join(opt.binDir, 'cordova'), 'config.xml'));
                cordovaCfg.doc.find('content').attrib.src = opt.remoteIndex;
                //add allow-navigation
                var ret = new et.Element('allow-navigation');
                ret.attrib['href'] = '*';
                cordovaCfg.doc.getroot().append(ret);
                cordovaCfg.write();
            }
        })
        .then(function () {
            process.chdir(path.join(opt.binDir, 'cordova'));
            return cordova.plugins('add', opt.cordovaPlugins);
        })
        .then(function () {
            return cordova.platform('add', path.join(cwd, 'node_modules', 'cordova-android'));
        })
        //.then(function () {
        //    return cordova.platform('add', path.join(cwd, 'node_modules', 'cordova-android'));
        //})
        .then(function () {
            process.chdir(cwd);
            callback();
        })
        .error(function (err) {
            console.error(err, 'An Error occurred!');
            process.chdir(cwd);
            callback();
        });
});


/**
 * BUILD:CORDOVA
 */
gulp.task('build:cordova', [ 'prepare:cordova' ], function (callback) {
    var cwd = process.cwd();
    process.chdir(path.join(opt.binDir, 'cordova'));
    cordova.build()
        .then(function () {
            process.chdir(cwd);
            callback();
        });
});


/**
 * EMULATE:CORDOVA
 */
gulp.task('emulate:cordova', [ 'prepare:cordova' ], function (callback) {
    var cfg = { platforms: [ opt.cordovaPlatform ] };
    var cwd = process.cwd();
    process.chdir(path.join(opt.binDir, 'cordova'));
    cordova.emulate(cfg)
        .then(function () {
            process.chdir(cwd);
            callback();
        });
});


/**
 * RUN:CORDOVA
 */
gulp.task('run:cordova', [ 'prepare:cordova' ], function (callback) {
    var cfg = { platforms: [ opt.cordovaPlatform ] };
    var cwd = process.cwd();
    process.chdir(path.join(opt.binDir, 'cordova'));
    cordova.run(cfg)
        .then(function () {
            process.chdir(cwd);
            callback();
        });
});


/*
 * SERVE:CORDOVA
 */
gulp.task('serve:cordova', [ 'serve:www' ], function (callback) {
    runSequence('run:cordova', function () {
        callback();
    });
});


/*
 * BUILD:ELECTRON
 */
gulp.task('build:electron', [ 'clean:electron' ], function (callback) {
    buildElectron().then(function (appPath) {
        console.log(appPath);
        callback();
    });
});


/**
 * RUN:ELECTRON
 */
gulp.task('run:electron', function () {
    runElectron();
});


/**
 * SERVE:ELECTRON
 */
gulp.task('serve:electron', [ 'serve:www' ], function () {
    runElectron(opt.remoteIndex);
});

function runElectron (indexUrl) {
    var appPath = path.join(opt.binDir, 'electron', opt.electronPlatform + '_' + opt.electronArch);
    var exePath = null;
    var wwwBase = null;
    switch (opt.electronPlatform) {
        case 'darwin' :
            exePath = path.join(appPath, opt.name + '.app', 'Contents', 'MacOS', 'Electron');
            wwwBase = path.join(appPath, opt.name + '.app', 'Contents', 'Resources', 'app');
            break;
        case 'win32' :
            exePath = path.join(appPath, opt.name + '-win32', opt.name + '.exe');
            wwwBase = path.join(appPath, opt.name + '-win32', 'resources', 'app');
            break;
        case 'linux' :
            exePath = appPath;
            wwwBase = path.join(appPath, 'resources', 'default_app');
            break;
    }
    if (indexUrl) {
        proc.spawn(exePath, [ wwwBase, '--index', indexUrl]);
    }
    else {
        proc.spawn(exePath);
    }
}


function buildElectron () {
    var cwd = escapeRegExp(process.cwd() + '/');
    var electronOpt = {
        dir: '.',
        name: opt.name,
        platform: opt.electronPlatform,
        arch: opt.electronArch,
        version: opt.electronVersion,
        out: path.join(opt.binDir, 'electron', opt.electronPlatform + '_' + opt.electronArch),
        icon: null,
        "app-bundle-id": opt.packageName,
        "helper-bundle-id": opt.helperPackageName,
        "app-version": opt.version,
        ignore: [ cwd + '\\..+$', cwd + 'bin$', cwd + 'src$', cwd + 'test$', cwd + 'wct.conf.js$', cwd + 'README.md$',
            cwd + 'gulpfile.js$', cwd + 'example.html$', cwd + 'appconfig.json$' ],
        prune: true
    };

    return Q.fcall(function () {
        var defer = Q.defer();
        electronPackager(electronOpt, function (err, appPath) {
            if (err) {
                defer.reject(err);
            } else {
                defer.resolve(appPath);
            }
        });
        return defer.promise;
    });
}



/**
 * DEFAULT
 */
gulp.task('default', [ 'build:www' ], function (callback) {
    runSequence('serve:www', function () {
        callback();
    });
});

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}
