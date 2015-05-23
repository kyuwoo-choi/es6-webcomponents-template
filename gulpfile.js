'use strict';

var chalk = require('chalk');
var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var es6ify = require('es6ify');
var runSequence = require('run-sequence');
var argv = require('yargs').argv;
var browserSync = require('browser-sync').create();
var reload = browserSync.reload;
require('web-component-tester').gulp.init(gulp);


var srcDir = argv.srcDir || 'src';
var tempDir = argv.tempDir || '.tmp';
var distDir = argv.distDir || 'dist';
var testDir = argv.testDir || 'test';
var indexFile = argv.index || 'example.html';
var compileEnv = argv.env || process.env.NODE_ENV || 'development'; //'development' || 'production'
var transpiler = argv.transpiler || 'es6ify'; //'babelify' || 'es6ify'
var minifyHtml = argv.minifyHtml || argv.minify || (compileEnv === 'production');
var minifyScript = argv.minifyScript || argv.minify || (compileEnv === 'production');
var minifyCss = argv.minifyCss || argv.minify || (compileEnv === 'production');
var inlineScript = argv.inlineScript || (compileEnv === 'production');
var inlineCss = argv.inlineCss || false; //TODO vulcanize inlineCss option only works with <link rel="import" type="css> not <link rel="stylesheet"> so transform rel="stylesheet" to rel="import" first.
var generateSourceMap = argv.generateSourceMap || (compileEnv === 'development');

(function verbose (enabledChalk, disabledChalk) {
    function write (key, value) {
        console.log((value ? enabledChalk(key + value) : disabledChalk(key + value)));
    }
    write('INDEX :              ', indexFile);
    write('SRC DIR :            ', srcDir);
    write('TEMP DIR :           ', tempDir);
    write('DIST DIR :           ', distDir);
    write('TEST DIR :           ', testDir);
    write('ENV :                ', compileEnv);
    write('TRANSPILER :         ', transpiler);
    write('INLINE SCRIPT :      ', inlineScript);
    write('INLINE CSS :         ', inlineCss);
    write('MINIFY HTML :        ', minifyHtml);
    write('MINIFY SCRIPT :      ', minifyScript);
    write('MINIFY CSS :         ', minifyCss);
    write('GENERATE SOURCEMAP : ', generateSourceMap);
})(chalk.green, chalk.gray);

/**
 * CLEAN:TEMP
 */
gulp.task('clean:temp', function () {
    return gulp.src([ tempDir ], { read: false })
        .pipe($.plumber())
        .pipe($.clean());
});

/**
 * CLEAN:DIST
 */
gulp.task('clean:dist', function () {
    return gulp.src([ distDir ], { read: false })
        .pipe($.plumber())
        .pipe($.clean());
});

/**
 * CLEAN
 */
gulp.task('clean', function (callback) {
    return runSequence([ 'clean:temp', 'clean:dist' ], callback);
});


/**
 * COPY:HTML
 */
gulp.task('copy:html', function () {
    return gulp.src(srcDir + '/**/*.html')
        .pipe($.plumber())
        .pipe(gulp.dest(tempDir));
});


/**
 * COPY:RESOURCE
 */
gulp.task('copy:resource', function () {
    var excludeHtmlJsCssFilter = $.filter([ '**', '!**/*.html', '!**/*.js', '!**/*.css' ]);
    var excludeFolderFilter = $.filter(function (file) {
        return file.stat.isFile();
    });

    return gulp.src(srcDir + '/**')
        .pipe($.plumber())
        .pipe(excludeHtmlJsCssFilter)
        .pipe(excludeFolderFilter)
        .pipe(gulp.dest(tempDir))
        .pipe(gulp.dest(distDir))
        .pipe(excludeFolderFilter.restore())
        .pipe(excludeHtmlJsCssFilter.restore());
});


/**
 * VULCANIZE:HTML
 */
gulp.task('vulcanize:html', function () {
    var injects = gulp.src([ es6ify.runtime ], { read: false });

    return gulp.src(tempDir + '/*.html')
        .pipe($.plumber())
        .pipe($.inject(injects))
        .pipe($.vulcanize({
            inlineScripts: inlineScript,
            inlineCss:     inlineCss
        }))
        .pipe($.htmlMinifier({
            removeComments:     minifyHtml,
            collapseWhitespace: minifyHtml,
            preserveLineBreaks: !minifyHtml,
            minifyJS:           minifyScript,
            minifyCSS:          minifyCss
        }))
        .pipe(gulp.dest('./dist'));
});


/**
 * BUILD:JS
 */
gulp.task('build:js', function () {
    return gulp.src(srcDir + '/**/*.js')
        .pipe($.plumber())
        .pipe($.eslint())
        .pipe($.eslint.format())
        .pipe($.if(transpiler === 'babelify', $.browserify({
            debug:     generateSourceMap,
            transform: [ 'babelify' ]
        })))
        .pipe($.if(transpiler === 'es6ify', $.browserify({
            debug:     generateSourceMap,
            transform: [ 'es6ify' ]
        })))
        .pipe($.if(generateSourceMap, $.sourcemaps.init({ loadMaps: true })))
        .pipe($.if(minifyScript, $.uglify()))
        .pipe($.if(generateSourceMap, $.sourcemaps.write('.', {
            sourceRoot: '.'
        })))
        .pipe(gulp.dest(tempDir))
        .pipe($.if((!inlineScript), gulp.dest(distDir)));
});


/**
 * BUILD:CSS
 */
gulp.task('build:css', function () {
    return gulp.src(srcDir + '/**/*.css')
        .pipe($.plumber())
        .pipe($.if(minifyCss && generateSourceMap, $.sourcemaps.init({ loadMaps: true })))
        .pipe($.if(minifyCss, $.minifyCss()))
        .pipe($.if(minifyCss && generateSourceMap, $.sourcemaps.write('.', {
            sourceRoot: '.'
        })))
        .pipe(gulp.dest(tempDir))
        .pipe($.if((!inlineCss), gulp.dest(distDir)));
});


/**
 * BUILD:HTML
 */
gulp.task('build:html', function (callback) {
    return runSequence('copy:html', 'vulcanize:html', 'clean:temp', callback);
});


/**
 * BUILD:ALL
 */
gulp.task('build:all', function (callback) {
    return runSequence('clean', 'copy:resource', [ 'build:js', 'build:css' ], 'build:html', 'test:local', callback);
});


/*
 * SERVE
 */
gulp.task('serve', [ 'build:all' ], function () {
    browserSync.init({
        server: {
            baseDir: './',
            index:   indexFile
        }
    });

    var watchList = [ distDir + '/*.html', distDir + '/*.js', distDir + '/*.css' ];
    gulp.watch(watchList).on('change', reload);
    gulp.watch(watchList, [ 'test:local' ]);
    gulp.watch(testDir + '/**/*', [ 'test:local' ]);
});


/**
 * DEFAULT
 */
gulp.task('default', [ 'serve' ], function () {
    gulp.watch(srcDir + '/**/*.css', [ 'build:css' ]);
    gulp.watch(srcDir + '/**/*.js', [ 'build:js' ]);
    gulp.watch(srcDir + '/**/*.html', [ 'build:html' ]);
});
