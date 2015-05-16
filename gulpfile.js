'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var es6ify = require('es6ify');
var runSequence = require('run-sequence');
var browserSync = require('browser-sync').create();
var reload      = browserSync.reload;

var indexHtml = './index.html';
var exampleHtml = './example.html';
var srcDir = './src';
var tempDir = './.tmp';
var distDir = './dist';
var entryHtmlArray = ['name-paper.html'];
var entryJsArray = ['name-paper.js'];
var isDebug = true;
var es6Transpiler = 'babelify'; //'babelify' || 'es6ify'


/**
 * CLEAN
 */
gulp.task('clean', function () {
    return gulp.src([tempDir, distDir])
        .pipe($.plumber())
        .pipe($.clean());
});

/**
 * TEMP-COPY-HTML
 */
gulp.task('temp-copy-html', function () {
    return gulp.src(srcDir + '/**/*.html')
        .pipe($.plumber())
        .pipe(gulp.dest(tempDir));
});

/**
 * BUILD-JS
 */
gulp.task('build-js', function () {
    return gulp.src(srcDir + '/**/*.js')
        .pipe($.plumber())
        .pipe($.if(es6Transpiler === 'babelify', $.browserify({
            debug: isDebug,
            transform: ['babelify']
        })))
        .pipe($.if(es6Transpiler === 'es6ify', $.browserify({
            debug: isDebug,
            add: [es6ify.runtime],
            transform: ['es6ify']
        })))
        .pipe($.sourcemaps.init({loadMaps: isDebug}))
        .pipe($.uglify())
        .pipe($.sourcemaps.write('.', {
            sourceRoot: '.'
        }))
        .pipe(gulp.dest(tempDir))
        .pipe($.if(isDebug, gulp.dest(distDir)));
});

/**
 * VULCANIZE-HTML
 */
gulp.task('vulcanize-html', function () {
    var tempEntryHtml = [];
    for (var entryHtml in entryHtmlArray) {
        tempEntryHtml.push(tempDir + '/' + entryHtmlArray[entryHtml]);
    }

    return gulp.src(tempEntryHtml)
        .pipe($.plumber())
        .pipe($.vulcanize({
            inlineScripts: !isDebug,
            inlineCss: !isDebug
        }))
        .pipe($.if(!isDebug, $.htmlMinifier({
            collapseWhitespace: !isDebug,
            minifyJS: !isDebug,
            minifyCSS: !isDebug,
            removeComments: !isDebug
        })))
        .pipe(gulp.dest('./dist'));
});

/**
 * BUILD-HTML
 */
gulp.task('build-html', function (callback) {
    return runSequence('temp-copy-html', 'vulcanize-html', callback);
});

/**
 * BUILD-ALL
 */
gulp.task('build-all', function (callback) {
    isDebug = true;
    return runSequence('clean', ['build-js', 'temp-copy-html'], 'vulcanize-html', callback);
});

/**
 * BUILD-ALL-PRODUCTION
 */
gulp.task('build-all-production', function (callback) {
    isDebug = false;
    return runSequence('clean', ['build-js', 'temp-copy-html'], 'vulcanize-html', callback);
});

/*
 * SERVE
 */
gulp.task('serve', ['build-all'], function() {
    browserSync.init({
        server: {
            baseDir: './',
            index: exampleHtml
        }
    });

    var watchArray = [];
    for (var entryHtml in entryHtmlArray) {
        watchArray.push(distDir + '/' + entryHtmlArray[entryHtml]);
    }
    for (var entryJs in entryJsArray) {
        watchArray.push(distDir + '/' + entryJsArray[entryJs]);
    }

    gulp.watch(watchArray).on('change', reload);
});

/**
 * DEFAULT
 */
gulp.task('default', ['serve'], function () {
    gulp.watch(srcDir + '/**/*.js', ['build-js']);
    gulp.watch(srcDir + '/**/*.html', ['build-html']);
});