( function () {
    'use strict';

    var OSG = window.OSG;
    var osg = OSG.osg;
    var osgViewer = OSG.osgViewer;
    var osgDB = OSG.osgDB;
    var viewer;
    var rootNode;
    var bodyNames;
    var bodies;
    var static_transforms;
    var configurations;

    var FindByNameVisitor = function ( name ) {
      osg.NodeVisitor.call( this, osg.NodeVisitor.TRAVERSE_ALL_CHILDREN );
      this._name = name;
    };

    FindByNameVisitor.prototype = osg.objectInherit( osg.NodeVisitor.prototype, {
      // in found we'll store our resulting matching node
      init: function () {
        this.found = undefined;
      },
      // the crux of it
      apply: function ( node ) {
        if ( node.getName() == this._name ) {
          this.found = node;
          return;
        }
        this.traverse( node );
      }
    } );

    var toolbar = new function () {
      this.load = function () {
        loadConfigs( '../media/datas/pr2_test.json');
      };

      this.playPath = function () {
        this.playPath_timeout (0);
      };

      this.playPath_timeout = function (i) {
        if (i < configurations.length) {
          applyConfig (i);
          i++;
          if (i < configurations.length) {
            var me = this;
            window.setTimeout (function () {
              me.playPath_timeout (i)
            }, 100);
          }
        }
      };

      this.sliderPath = function () {
        // this is the input range element
        if (parseInt(this.value) > parseInt(this.max)) {
          this.value = this.max;
        }
        applyConfig (Math.floor (this.value * (configurations.length-1) / this.max));
      };
    }

    var loadModel = function ( data, viewer, node ) {
        var promise = osgDB.parseSceneGraph( data );

        promise.then( function ( child ) {
            node.addChild( child );
            viewer.getManipulator().computeHomePosition();

            /*// console.time( 'build' );*/
            /*var treeBuilder = new osg.KdTreeBuilder( {*/
            /*_numVerticesProcessed: 0,*/
            /*_targetNumTrianglesPerLeaf: 50,*/
            /*_maxNumLevels: 20*/
            /*} );*/
            /*treeBuilder.apply( node );*/
            /*// console.timeEnd( 'build' );*/
        } );
    };

    var loadUrl = function ( url, viewer, node ) {
        osg.log( 'loading ' + url );
        var req = new XMLHttpRequest();
        req.open( 'GET', url, true );
        req.onload = function ( /*aEvt*/) {
            loadModel( JSON.parse( req.responseText ), viewer, node );
            osg.log( 'success ' + url );
        };
        req.onerror = function ( /*aEvt */) {
            osg.log( 'error ' + url );
        };
        req.send( null );
    };

    var loadConfigs = function ( url ) {
        osg.log( 'loading ' + url );
        var req = new XMLHttpRequest();
        req.open( 'GET', url, true );
        req.onload = function ( /*aEvt*/) {
          var ret = JSON.parse (req.responseText);
          bodyNames = ret.bodies;
          static_transforms = ret.static_transform;
          configurations = ret.configurations;
          initConfig ();
          setupStaticObjects (ret.static_object_names, ret.static_object_transform);
          applyConfig (0);
          viewer.getManipulator().computeHomePosition();
          osg.log( 'success ' + url );
        };
        req.onerror = function ( /*aEvt */) {
            osg.log( 'error ' + url );
        };
        req.send( null );
    };

    var createScene = function ( viewer ) {
        rootNode = new osg.Node();
        loadUrl( '../media/models/pr2_2.osgjs', viewer, rootNode );
        return rootNode;
    };

    var setupStaticObjects = function (names, transs) {
      for (var i = 0; i < names.length; i++) {
        if (transs[i].length != 7) {
          continue;
        }
        var finder = new FindByNameVisitor( names[i] );
        rootNode.accept( finder );
        if (finder.found !== undefined) {
          var sw = finder.found;
          var swchildren = sw.getChildren ();

          var t = new osg.MatrixTransform ();
          var pos = transs[i];
          osg.Matrix.setTrans (t.getMatrix(), pos[0], pos[1], pos[2]);
          var q = [pos[4], pos[5], pos[6], pos[3]];
          osg.Matrix.setRotateFromQuat (t.getMatrix(), q);

          sw.addChild (t);
          t.addChild (swchildren[0]);
          t.addChild (swchildren[1]);
          sw.removeChild (swchildren[0]);
          sw.removeChild (swchildren[0]);
        }
      }
    }

    var initConfig = function () {
      bodies = new Array ();
      for (var i = 0; i < bodyNames.length; i++) {
        var finder = new FindByNameVisitor( bodyNames[i] );
        rootNode.accept( finder );
        if (finder.found !== undefined) {
          var sw = finder.found;
          var swchildren = sw.getChildren ();

          var p = new osg.MatrixTransform (), c = p;
          if (static_transforms[i].length == 7) {
            var c = new osg.MatrixTransform ();

            var pos = static_transforms[i];
            osg.Matrix.setTrans (c.getMatrix(), pos[0], pos[1], pos[2]);
            /*var q = [pos[6], pos[3], pos[4], pos[5]];*/
            var q = [pos[4], pos[5], pos[6], pos[3]];
            /*var q = [pos[3], pos[4], pos[5], pos[6]];*/
            osg.Matrix.setRotateFromQuat (c.getMatrix(), q);

            p.addChild (c);
          }

          sw.addChild (p);
          c.addChild (swchildren[0]);
          c.addChild (swchildren[1]);
          sw.removeChild (swchildren[0]);
          sw.removeChild (swchildren[0]);
          bodies.push (p);
        } else {
          bodies.push (0);
        }
      }
    }

    var applyConfig = function (i) {
      var pos;
      var m;
      for (var j = 0; j < bodies.length; j++) {
        if (bodies[j] == 0) continue;
        m = bodies[j].getMatrix ();
        pos = configurations[i][j];
        osg.Matrix.setTrans (m, pos[0], pos[1], pos[2]);
        /*var q = [pos[3], pos[4], pos[5], pos[6]];*/
        var q = [pos[4], pos[5], pos[6], pos[3]];
        // TODO: Here we need to have the static tranform
        osg.Matrix.setRotateFromQuat (m, q);
      }
    }

    var onLoad = function () {
        var canvas = document.getElementById( 'View' );

        viewer = new osgViewer.Viewer( canvas );
        viewer.init();
        viewer.setSceneData( createScene( viewer ) );
        viewer.setupManipulator();
        viewer.run();

        document.getElementById ("loadConfig").addEventListener ('click', toolbar.load, true);
        /*document.getElementById ("playPath")  .addEventListener ('click', toolbar.playPath, true);*/
        document.getElementById ("playPath")  .addEventListener ('click', function (e) {toolbar.playPath()}, true);
        document.getElementById ("sliderPath").addEventListener ('input', toolbar.sliderPath, true);
    };

    window.addEventListener( 'load', onLoad, true );
} )();
