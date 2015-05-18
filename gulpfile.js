'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var es6ify = require('es6ify');
var runSequence = require('run-sequence');
var argv = require('yargs').argv;
var browserSync = require('browser-sync').create();
var reload = browserSync.reload;
require('web-component-tester').gulp.init(gulp);

var srcDir = './src';
var tempDir = './.tmp';
var distDir = './dist';
var testDir = './test';
var indexFile = './example.html';
var entryHtmlArray = ['example-component.html'];
var entryJsArray = ['example-component.js'];
var entryCssArray = ['example-component.css'];

var es6Transpiler = process.env.ES6_TRANSPILER || 'babelify'; //'babelify' || 'es6ify'
if (argv.es6ify) {
    es6Transpiler = 'es6ify';
}

var compileEnv = process.env.NODE_ENV || 'development'; //'development' || 'production'
if (argv.production) {
    compileEnv = 'production';
}


console.log('compile env : ' + compileEnv);
console.log('es6 transpiler : ' + es6Transpiler);


/**
 * CLEAN
 */
gulp.task('clean', function () {
    return gulp.src([ tempDir, distDir ])
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
        .pipe($.eslint())
        .pipe($.eslint.format())
        .pipe($.if(es6Transpiler === 'babelify', $.browserify({
            debug:     (compileEnv === 'development'),
            transform: ['babelify']
        })))
        .pipe($.if(es6Transpiler === 'es6ify', $.browserify({
            debug:     (compileEnv === 'development'),
            add:       [es6ify.runtime],
            transform: ['es6ify']
        })))
        .pipe($.sourcemaps.init({ loadMaps: true }))
        .pipe($.uglify())
        .pipe($.sourcemaps.write('.', {
            sourceRoot: '.'
        }))
        .pipe(gulp.dest(tempDir))
        .pipe($.if((compileEnv === 'development'), gulp.dest(distDir)));
});


/**
 * BUILD-CSS
 */
gulp.task('build-css', function () {
    return gulp.src(srcDir + '/**/*.css')
        .pipe($.plumber())
        .pipe($.sourcemaps.init({ loadMaps: true }))
        .pipe($.minifyCss())
        .pipe($.sourcemaps.write('.', {
            sourceRoot: '.'
        }))
        .pipe(gulp.dest(tempDir));
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
            inlineScripts: (compileEnv === 'production'),
            inlineCss:     true
        }))
        .pipe($.if((compileEnv === 'production'), $.htmlMinifier({
            collapseWhitespace: (compileEnv === 'production'),
            minifyJS:           (compileEnv === 'production'),
            minifyCSS:          (compileEnv === 'production'),
            removeComments:     (compileEnv === 'production')
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
    return runSequence('clean', [ 'build-js', 'build-css', 'temp-copy-html' ], 'vulcanize-html', 'test:local', callback);
});


/*
 * SERVE
 */
gulp.task('serve', ['build-all'], function () {
    browserSync.init({
        server: {
            baseDir: './',
            index:   indexFile
        }
    });

    var watchArray = [];
    for (var entryHtml in entryHtmlArray) {
        watchArray.push(distDir + '/' + entryHtmlArray[entryHtml]);
    }
    for (var entryJs in entryJsArray) {
        watchArray.push(distDir + '/' + entryJsArray[entryJs]);
    }
    for (var entryCss in entryCssArray) {
        watchArray.push(distDir + '/' + entryJsArray[entryCss]);
    }

    gulp.watch(watchArray).on('change', reload);
    gulp.watch(watchArray, ['test:local']);
    gulp.watch(testDir + '/**/*', ['test:local']);
});


/**
 * DEFAULT
 */
gulp.task('default', ['serve'], function () {
    gulp.watch(srcDir + '/**/*.css', ['build-css']);
    gulp.watch(srcDir + '/**/*.js', ['build-js']);
    gulp.watch(srcDir + '/**/*.html', ['build-html']);
});
