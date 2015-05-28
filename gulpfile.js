'use strict';

var path = require('path');
var chalk = require('chalk');
var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var runSequence = require('run-sequence');
var argv = require('yargs').argv;
var browserSync = require('browser-sync').create();
require('web-component-tester').gulp.init(gulp);
var cordova = require('cordova-lib').cordova.raw; // promises API

var opt = {};
opt.srcDir = argv.srcDir || 'src';
opt.componentDir = argv.componentDir || 'component';
opt.tempDir = argv.tempDir || '.temp';
opt.distDir = argv.distDir || 'dist';
opt.testDir = argv.testDir || 'test';
opt.indexFile = argv.index || 'index.html';
opt.compileEnv = argv.env || process.env.NODE_ENV || 'development'; //'development' || 'production'
opt.transpiler = argv.transpiler || 'traceur'; //'babel' || 'traceur'
opt.minifyHtml = argv.minifyHtml || argv.minify || (opt.compileEnv === 'production');
opt.minifyScript = argv.minifyScript || argv.minify || (opt.compileEnv === 'production');
opt.minifyCss = argv.minifyCss || argv.minify || (opt.compileEnv === 'production');
opt.inlineScript = argv.inlineScript || (opt.compileEnv === 'production');
opt.inlineCss = argv.inlineCss || (opt.compileEnv === 'production');
opt.generateSourceMap = argv.generateSourceMap || (opt.compileEnv === 'development');
opt.excludeVulcanize = argv.excludeVulcanize || [ path.join('bower_components', 'webcomponentsjs') ];
//TODO vulcanize inlineScript breaks in some cases. https://github.com/Polymer/vulcanize/issues/113
opt.binDir = argv.binDir || 'bin';
opt.cordovaPlugins = argv.cordovaPlugins || [ 'com.tokbox.cordova.opentok', 'org.apache.cordova.console' ];
opt.cordovaPlatform = argv.cordovaPlatform || 'android'; //android || ios
opt.packageName = argv.packageName || 'com.example';
opt.name = argv.name || 'test';

(function verbose (enabledChalk, disabledChalk) {
    function write (key, value) {
        console.log((value ? enabledChalk(key + value) : disabledChalk(key + value)));
    }
    write('INDEX :              ', opt.indexFile);
    write('SRC DIR :            ', opt.srcDir);
    write('TEMP DIR :           ', opt.tempDir);
    write('DIST DIR :           ', opt.distDir);
    write('TEST DIR :           ', opt.testDir);
    write('BIN DIR :            ', opt.excludeVulcanize);
    write('ENV :                ', opt.compileEnv);
    write('TRANSPILER :         ', opt.transpiler);
    write('INLINE SCRIPT :      ', opt.inlineScript);
    write('INLINE CSS :         ', opt.inlineCss);
    write('MINIFY HTML :        ', opt.minifyHtml);
    write('MINIFY SCRIPT :      ', opt.minifyScript);
    write('MINIFY CSS :         ', opt.minifyCss);
    write('GENERATE SOURCEMAP : ', opt.generateSourceMap);
    write('EXCLUDE VULCANIZE :  ', opt.excludeVulcanize);
    write('NAME :               ', opt.name);
    write('PACKAGE NAME :       ', opt.packageName);
    write('CORDOVA PLATFORM :   ', opt.cordovaPlatform);
    write('CORDOVA PLUGINS :    ', opt.cordovaPlugins);
})(chalk.green, chalk.gray);


/**
 * CLEAN
 */
gulp.task('clean', function () {
    return gulp.src([ opt.tempDir, opt.distDir, opt.binDir ], { read: false })
        .pipe($.plumber())
        .pipe($.clean());
});


/**
 * CLEAN:CORDOVA
 */
gulp.task('clean:cordova', function () {
    return gulp.src([ opt.binDir ], { read: false })
        .pipe($.plumber())
        .pipe($.clean());
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
 * BUILD:ALL
 */
gulp.task('build:all', [ 'clean' ], function (callback) {
    return runSequence([ 'prepare:resource', 'build:js', 'build:css' ], 'build:html', 'test:local', callback);
});


/**
 * PREPARE:CORDOVA
 */
gulp.task('prepare:cordova', [ 'clean:cordova' ], function (callback) {
    var cfg = {lib: {www: {uri: opt.distDir, url: opt.distDir, link: false}}};
    var cwd = process.cwd();
    cordova.create(opt.binDir, opt.packageName, opt.name, cfg)
        .then(function () {
            process.chdir(opt.binDir);
            return cordova.plugins('add', opt.cordovaPlugins);
        })
        .then(function () {
            return cordova.platform('add', path.join('..', 'node_modules', 'cordova-android'));
        })
        //.then(function () {
        //    return cordova.platform('add', path.join('..', 'node_modules', 'cordova-ios'));
        //})
        .then(function () {
            process.chdir(cwd);
            callback();
        });
});


/**
 * BUILD:CORDOVA
 */
gulp.task('build:cordova', [ 'prepare:cordova' ], function (callback) {
    var cwd = process.cwd();
    process.chdir(opt.binDir);
    cordova.build()
        .then(function () {
            process.chdir(cwd);
            callback();
        });
});


/**
 * RUN:CORDOVA
 */
gulp.task('run:cordova', [ 'build:cordova' ], function (callback) {
    var cfg = { platforms: [ opt.cordovaPlatform ] };
    var cwd = process.cwd();
    process.chdir(opt.binDir);
    cordova.run(cfg)
        .then(function () {
            process.chdir(cwd);
            callback();
        });
});


/**
 * EMULATE:CORDOVA
 */
gulp.task('emulate:cordova', [ 'build:cordova' ], function (callback) {
    var cfg = { platforms: [ opt.cordovaPlatform ] };
    var cwd = process.cwd();
    process.chdir(opt.binDir);
    cordova.emulate(cfg)
        .then(function () {
            process.chdir(cwd);
            callback();
        });
});


/*
 * SERVE
 */
gulp.task('serve', [ 'build:all' ], function () {
    var watchList = [ opt.distDir + '/*', opt.distDir + '/component/**', opt.distDir + '/js/**', opt.testDir + '/**' ];

    browserSync.init({
        files: watchList,
        startPath: opt.indexFile,
        server: {
            baseDir: opt.distDir
        }
    });
});


/**
 * DEFAULT
 */
gulp.task('default', [ 'serve' ], function () {
    gulp.watch(opt.srcDir + '/**/*.css', [ 'build:css' ]);
    gulp.watch(opt.srcDir + '/**/*.js', [ 'build:js' ]);
    gulp.watch(opt.srcDir + '/**/*.html', [ 'build:html' ]);
});
