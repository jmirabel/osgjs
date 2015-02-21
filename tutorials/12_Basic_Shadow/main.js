// from require to global var
var OSG = window.OSG;
OSG.globalify();
var osg = window.osg;
var osgViewer = window.osgViewer;
var osgShadow = window.osgShadow;
var osg = window.osg;
var osgDB = window.osgDB;

// Wait for it

window.addEventListener( 'load',
    function () {
        // The 3D canvas.
        var canvas = document.getElementById( '3DView' );
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        var viewer;

        var castsShadowTraversalMask = 0x2;

        // We create  boxes and ground which will be lighted
        var scene = new osg.MatrixTransform();
        var size = 5;
        var ground = osg.createTexturedBoxGeometry( 0, 0, -5, 400, 400, 0.1 );
        scene.addChild( ground );
        ground.setNodeMask( ~castsShadowTraversalMask );

        ground = osg.createTexturedBoxGeometry( -10, -10, 0, size, size, size );
        scene.addChild( ground );
        ground = osg.createTexturedBoxGeometry( 10, -10, 0, size, size, size );
        scene.addChild( ground );
        ground = osg.createTexturedBoxGeometry( -10, 10, 0, size, size, size );
        scene.addChild( ground );
        ground = osg.createTexturedBoxGeometry( 10, 10, 0, size, size, size );
        scene.addChild( ground );



        var LightRemoveVisitor = function () {
            osg.NodeVisitor.call( this );
            this.nodeList = [];
        };
        LightRemoveVisitor.prototype = osg.objectInherit( osg.NodeVisitor.prototype, {
            apply: function ( node ) {
                if ( ( node.getName() && node.getName().indexOf( 'Point' ) !== -1 ) || node.getTypeID() === osg.Light.getTypeID() ) {
                    this.nodeList.push( node );
                    return;
                }
                this.traverse( node );
            },
            clean: function () {
                for ( var i = 0; i < this.nodeList.length; i++ ) {
                    var node = this.nodeList[ i ];
                    var parents = node.getParents();
                    if ( parents && parents[ 0 ] ) parents[ 0 ].removeChild( node );
                }
            }
        } );

        var modelName = '../../examples/ssao/raceship.osgjs';
        var request = window.osgDB.readNodeURL( modelName );
        request.then( function ( loadedModel ) {
            var lightRmv = new LightRemoveVisitor();
            loadedModel.accept( lightRmv );
            lightRmv.clean();
            loadedModel.setName( 'model' );
            scene.addChild( loadedModel );
        } );

        // 1 light for 4 boxes and a ground
        var mainNode = new osg.Node();
        var lightnew = new osg.Light( 0 );

        // pretty spotlight fallof showing
        // clearly directions
        var spot = false;
        if ( spot ) {
            lightnew.setSpotCutoff( 45 );
            lightnew.setSpotBlend( 1.0 );
            lightnew.getPosition()[ 3 ] = 1;
            lightnew.setLightType( osg.Light.SPOT );
        } else {
            lightnew.setSpotCutoff( 190 );
            lightnew.getPosition()[ 3 ] = 0;
            lightnew.setLightType( osg.Light.DIRECTION );
        }

        lightnew.setConstantAttenuation( 0 );
        lightnew.setLinearAttenuation( 0.005 );
        lightnew.setQuadraticAttenuation( 0 );

        lightnew.setName( 'light0' );
        lightnew._enabled = true;

        // light source is a node handling the light
        var lightSourcenew = new osg.LightSource();
        lightSourcenew.setName( 'lightNode0' );
        lightSourcenew.setLight( lightnew );

        // node helping position the light
        var lightNodemodelNodeParent = new osg.MatrixTransform();

        // Important: set the light as attribute so that it's inhered by all node under/attached the mainNode
        mainNode.getOrCreateStateSet().setAttributeAndModes( lightnew );

        // setting light, each above its cube
        lightNodemodelNodeParent.setMatrix( osg.Matrix.makeTranslate( -10, -10, 10, osg.Matrix.create() ) );

        // red light
        lightnew.setAmbient( [ 0.0, 0, 0.0, 1.0 ] );
        lightnew.setDiffuse( [ 0.5, 0.5, 0.5, 1.0 ] );
        lightnew.setSpecular( [ 0.5, 0.5, 0.5, 1.0 ] );

        /////////////////// Shadow
        var shadowedScene = new osgShadow.ShadowedScene();
        shadowedScene.addChild( scene );

        var shadowSettings = new osgShadow.ShadowSettings();

        shadowSettings.bias = 0.25;
        shadowSettings.setCastsShadowTraversalMask( castsShadowTraversalMask );
        shadowSettings.setLightSource( lightSourcenew );

        var shadowMap = new osgShadow.ShadowMap( shadowSettings );
        shadowedScene.addShadowTechnique( shadowMap );
        shadowMap.setShadowSettings( shadowSettings );

        mainNode.addChild( shadowedScene );
        mainNode.addChild( lightSourcenew );
        /////////////////// Shadow end


        // The viewer
        viewer = new osgViewer.Viewer( canvas );
        viewer.init();
        // we'll do it ourself
        viewer.setLightingMode( osgViewer.View.LightingMode.NO_LIGHT );
        viewer.getCamera().setClearColor( [ 0.3, 0.3, 0.3, 0.3 ] );
        viewer.setSceneData( mainNode );
        viewer.setupManipulator();
        viewer.run();



    }, true );
