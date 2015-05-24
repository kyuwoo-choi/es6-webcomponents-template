'use strict';

var path = require('path');
var chalk = require('chalk');
var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
//var es6ify = require('es6ify');
var runSequence = require('run-sequence');
var argv = require('yargs').argv;
var browserSync = require('browser-sync').create();
require('web-component-tester').gulp.init(gulp);

var opt = {};
opt.srcDir = argv.srcDir || 'src';
opt.wwwDir = argv.wwwDir || 'www';
opt.componentDir = argv.componentDir || 'component';
opt.tempDir = argv.tempDir || '.tmp';
opt.distDir = argv.distDir || 'dist';
opt.testDir = argv.testDir || 'test';
opt.indexFile = argv.index || 'dist/www/index.html';
opt.compileEnv = argv.env || process.env.NODE_ENV || 'development'; //'development' || 'production'
opt.transpiler = argv.transpiler || 'traceur'; //'babel' || 'traceur'
opt.minifyHtml = argv.minifyHtml || argv.minify || (opt.compileEnv === 'production');
opt.minifyScript = argv.minifyScript || argv.minify || (opt.compileEnv === 'production');
opt.minifyCss = argv.minifyCss || argv.minify || (opt.compileEnv === 'production');
opt.inlineScript = argv.inlineScript || (opt.compileEnv === 'production');
opt.inlineCss = argv.inlineCss || false; //TODO vulcanize inlineCss option only works with <link rel="import" type="css> not <link rel="stylesheet"> so transform rel="stylesheet" to rel="import" first.
opt.generateSourceMap = argv.generateSourceMap || (opt.compileEnv === 'development');

(function verbose (enabledChalk, disabledChalk) {
    function write (key, value) {
        console.log((value ? enabledChalk(key + value) : disabledChalk(key + value)));
    }
    write('INDEX :              ', opt.indexFile);
    write('SRC DIR :            ', opt.srcDir);
    write('TEMP DIR :           ', opt.tempDir);
    write('DIST DIR :           ', opt.distDir);
    write('TEST DIR :           ', opt.testDir);
    write('ENV :                ', opt.compileEnv);
    write('TRANSPILER :         ', opt.transpiler);
    write('INLINE SCRIPT :      ', opt.inlineScript);
    write('INLINE CSS :         ', opt.inlineCss);
    write('MINIFY HTML :        ', opt.minifyHtml);
    write('MINIFY SCRIPT :      ', opt.minifyScript);
    write('MINIFY CSS :         ', opt.minifyCss);
    write('GENERATE SOURCEMAP : ', opt.generateSourceMap);
})(chalk.green, chalk.gray);


/**
 * CLEAN
 */
gulp.task('clean', function () {
    return gulp.src([ opt.tempDir, opt.distDir ], { read: false })
        .pipe($.plumber())
        .pipe($.clean());
});


/**
 * COPY:HTML
 */
gulp.task('copy:html', function () {
    var indexHtmlFilter = $.filter([ 'www/*.html' ]);
    return gulp.src(opt.srcDir + '/**/*.html')
        .pipe($.plumber())
        .pipe(gulp.dest(opt.tempDir))
        .pipe(indexHtmlFilter)
        .pipe(gulp.dest(opt.distDir))
        .pipe(indexHtmlFilter.restore());
});


/**
 * COPY:RESOURCE
 */
gulp.task('copy:resource', function () {
    var excludeHtmlJsCssFilter = $.filter([ '**', '!**/*.html', '!**/*.js', '!**/*.css' ]);
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
 * VULCANIZE:HTML
 */
gulp.task('vulcanize:html', function () {
    var injectFiles = gulp.src([ $.traceur.RUNTIME_PATH ], { read: false });

    var wwwFilter = $.filter([ '*.html' ]);
    var componentFilter = $.filter([ opt.componentDir + '/*.html' ]);

    return gulp.src(path.join(opt.tempDir, opt.wwwDir) + '/**/*.html')
        .pipe($.plumber())
        .pipe(wwwFilter)
        .pipe($.if(opt.transpiler === 'traceur', $.inject(injectFiles, { relative: true })))
        .pipe(wwwFilter.restore())
        .pipe(componentFilter)
        .pipe($.vulcanize({
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
        .pipe(componentFilter.restore())
        .pipe(gulp.dest(path.join(opt.distDir, opt.wwwDir)));
});


/**
 * BUILD:JS
 */
gulp.task('build:js', function () {
    var wwwFilter = $.filter([ opt.wwwDir + '/**/*.js' ]);

    return gulp.src(opt.srcDir + '/**/*.js')
        .pipe($.plumber())
        .pipe($.eslint())
        .pipe($.eslint.format())
        .pipe($.if(opt.generateSourceMap, $.sourcemaps.init({ loadMaps: true })))
        .pipe($.if(opt.transpiler === 'babel', $.babel()))
        .pipe($.if(opt.transpiler === 'traceur', $.traceur()))
        .pipe(wwwFilter)
        .pipe($.browserify())
        .pipe(wwwFilter.restore())
        .pipe($.if(opt.minifyScript, $.uglify()))
        .pipe($.if(opt.generateSourceMap, $.sourcemaps.write('.', {
            sourceRoot: '.'
        })))
        .pipe(gulp.dest(opt.tempDir))
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
 * BUILD:HTML
 */
gulp.task('build:html', function (callback) {
    return runSequence('copy:html', 'vulcanize:html', callback);
});


/**
 * BUILD:ALL
 */
gulp.task('build:all', function (callback) {
    //return runSequence('clean', 'copy:resource', [ 'build:js', 'build:css' ], 'build:html', 'test:local', callback);
    return runSequence('clean', 'copy:resource', [ 'build:js', 'build:css' ], 'build:html', 'test:local', callback);
});


/*
 * SERVE
 */
gulp.task('serve', [ 'build:all' ], function () {
    var wwwDir = path.join(opt.distDir, opt.wwwDir);
    var componentDir = path.join(opt.distDir, opt.wwwDir, opt.componentDir);
    var watchList = [ wwwDir + '/*.html', wwwDir + '/*.js', wwwDir + '/*.css',
        componentDir + '/*.html', componentDir + '/*.js', componentDir + '/*.css' ];

    browserSync.init({
        files: watchList,
        startPath: opt.indexFile,
        server: {
            baseDir: './'
        }
    });
    gulp.watch(watchList, [ 'test:local' ]);
    gulp.watch(opt.testDir + '/**/*', [ 'test:local' ]);
});


/**
 * DEFAULT
 */
gulp.task('default', [ 'serve' ], function () {
    gulp.watch(opt.srcDir + '/**/*.css', [ 'build:css' ]);
    gulp.watch(opt.srcDir + '/**/*.js', [ 'build:js' ]);
    gulp.watch(opt.srcDir + '/**/*.html', [ 'build:html' ]);
});
