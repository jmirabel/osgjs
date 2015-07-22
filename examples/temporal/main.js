( function () {
    'use strict';

    var viewer;
    var canvas;
    var rttAA1;
    var rttAA0;
    var rttFinal;

    var cameraRttAA0;
    var cameraRttAA1;
    var cameraFinal;
    var uniforms;
    var frameNum = 0;
    var halton;
    var configUI;
    var rotate;
    var shaderProcessor;
    var quad;

    var rttsArray = [];

    var rttDebugNode;

    var CustomCompiler = window.CustomCompiler;
    var TemporalAttribute = window.TemporalAttribute;

    var P = window.P;
    var $ = window.$;

    var OSG = window.OSG;
    var osg = OSG.osg;
    var osgGA = OSG.osgGA;
    var osgViewer = OSG.osgViewer;
    var osgShader = OSG.osgShader;
    var osgUtil = OSG.osgUtil;


    var filterCheck = osg.Texture.NEAREST;
    //var filter = osg.Texture.LINEAR;

    var main = function () {


        function createScene() {
            var group = new osg.Node();
            group.setName( 'group' );

            group.getOrCreateStateSet().setAttributeAndModes( new osg.CullFace( 'DISABLE' ) );

            var size = 1.0;

            // sort of background

            var ground = osg.createTexturedBoxGeometry( 0.0, 0.0, 0.0, size, size, size );
            ground.setName( 'groundBox' );

            var groundPlace = new osg.MatrixTransform();
            groundPlace.addChild( ground );
            var m = groundPlace.getMatrix();
            osg.Matrix.makeRotate( 0.0, 0.0, 0.0, 1.0, m );
            osg.Matrix.setTrans( m, 0.0, 0.0, 0.0 );
            group.addChild( groundPlace );

            ground.getOrCreateStateSet().setTextureAttributeAndModes( 0, osg.Texture.createFromURL( '../media/textures/seamless/bricks1.jpg' ) );

            /*
                group.addChild( osg.createGridGeometry( size, size, size,
                    size, size, size,
                    size, size, size,
                    10, 10 ) );
             */


            var gridDefinition = 15;
            var TheGrid = osg.createGridGeometry( -1.0, -1.0, 0.0, 2.0, 0.0, 0.0, 0.0, 2.0, 0.0, gridDefinition, gridDefinition );

            var material = new osg.Material();
            TheGrid.getOrCreateStateSet().setAttributeAndModes( material );
            material.setEmission( [ 1.0, 1.0, 1.0, 1.0 ] );
            material.setDiffuse( [ 1.0, 1.0, 1.0, 1.0 ] );
            material.setSpecular( [ 1.0, 1.0, 1.0, 1.0 ] );
            material.setAmbient( [ 1.0, 1.0, 1.0, 1.0 ] );

            group.addChild( TheGrid );

            return group;
        }


        // show the shadowmap as ui quad on left bottom screen
        // in fact show all texture inside this._rtt
        function showFrameBuffers( optionalArgs ) {

            var _ComposerdebugNode = new osg.Node();
            _ComposerdebugNode.setName( 'debugComposerNode' );
            _ComposerdebugNode.setCullingActive( false );
            var _ComposerdebugCamera = new osg.Camera();
            _ComposerdebugCamera.setName( '_ComposerdebugCamera' );
            rttDebugNode.addChild( _ComposerdebugCamera );

            var optionsDebug = {
                x: 0,
                y: 100,
                w: 100,
                h: 80,
                horizontal: true,
                screenW: 1024,
                screenH: 768,
                fullscreen: false
            };
            if ( optionalArgs )
                osg.extend( optionsDebug, optionalArgs );

            var matrixDest = _ComposerdebugCamera.getProjectionMatrix();
            osg.Matrix.makeOrtho( 0, optionsDebug.screenW, 0, optionsDebug.screenH, -5, 5, matrixDest );
            _ComposerdebugCamera.setProjectionMatrix( matrixDest ); //not really needed until we do matrix caches

            matrixDest = _ComposerdebugCamera.getViewMatrix();
            osg.Matrix.makeTranslate( 0, 0, 0, matrixDest );
            _ComposerdebugCamera.setViewMatrix( matrixDest );
            _ComposerdebugCamera.setRenderOrder( osg.Camera.NESTED_RENDER, 0 );
            _ComposerdebugCamera.setReferenceFrame( osg.Transform.ABSOLUTE_RF );
            _ComposerdebugCamera.addChild( _ComposerdebugNode );

            var texture;
            var xOffset = optionsDebug.x;
            var yOffset = optionsDebug.y;
            _ComposerdebugNode.removeChildren();

            var stateset;

            stateset = _ComposerdebugNode.getOrCreateStateSet();
            if ( !optionsDebug.fullscreen )
                stateset.setAttributeAndModes( new osg.Depth( 'DISABLE' ) );
            for ( var i = 0, l = rttsArray.length; i < l; i++ ) {
                texture = rttsArray[ i ];
                if ( texture ) {
                    var quad = osg.createTexturedQuadGeometry( xOffset, yOffset, 0, optionsDebug.w, 0, 0, 0, optionsDebug.h, 0 );

                    stateset = quad.getOrCreateStateSet();

                    quad.setName( 'debugCompoGeom' + i );

                    stateset.setTextureAttributeAndModes( 0, texture );
                    stateset.setAttributeAndModes( new osg.Depth( 'DISABLE' ) );

                    _ComposerdebugNode.addChild( quad );

                    if ( optionsDebug.horizontal ) xOffset += optionsDebug.w + 2;
                    else yOffset += optionsDebug.h + 2;
                }
            }
        }


        function createTextureRTT( name, filter, type ) {
            var texture = new osg.Texture();
            texture.setInternalFormatType( type );
            texture.setTextureSize( canvas.width, canvas.height );

            texture.setInternalFormat( osg.Texture.RGBA );
            texture.setMinFilter( filter );
            texture.setMagFilter( filter );
            texture.setName( name );
            return texture;
        }

        function createCameraRTT( texture, is3D ) {
            var camera = new osg.Camera();
            camera.setName( is3D ? 'MainCamera' : 'composer2D' );
            camera.setViewport( new osg.Viewport( 0, 0, canvas.width, canvas.height ) );

            camera.setRenderOrder( osg.Camera.PRE_RENDER, 0 );
            camera.attachTexture( osg.FrameBufferObject.COLOR_ATTACHMENT0, texture, 0 );

            //
            camera.setReferenceFrame( osg.Transform.ABSOLUTE_RF );

            if ( is3D ) {
                camera.attachRenderBuffer( osg.FrameBufferObject.DEPTH_ATTACHMENT, osg.FrameBufferObject.DEPTH_COMPONENT16 );
                camera.setClearColor( osg.Vec4.create( [ 0.0, 0.0, 0.1, 1.0 ] ) );
            } else {

                camera.setClearMask( 0 );

            }
            return camera;
        };


        //http://www.ben-peck.com/articles/halton/
        function haltonFunc( index, base ) {
            var result = 0.0;
            var f = 1.0 / base;
            var i = index;
            while ( i > 0 ) {
                result = result + f * ( i % base );
                i = Math.floor( i / base );
                f = f / base;
            }
            return result;
        }

        function updateUniforms() {

            if ( !halton ) return;
            // update frame num to know how to amortize
            frameNum++;

            // jitter the projection matrix
            halton[ 0 ] = haltonFunc( frameNum - 1, 4 ) - 0.5;
            halton[ 1 ] = haltonFunc( frameNum - 1, 3 ) - 0.5;

            halton[ 3 ] = frameNum;

            uniforms.halton.dirty();

        }


        var angle = 0.0;

        function rotateNode( nv ) {
            var t = nv.getFrameStamp().getSimulationTime();
            var dt = t - rotate._lastUpdate;
            if ( dt < 0 ) {
                return true;
            }
            rotate._lastUpdate = t;

            // rotation
            var m = rotate.getMatrix();
            osg.Matrix.makeRotate( angle, 0.0, 0.0, 1.0, m );
            osg.Matrix.setTrans( m, 0, 0, 0 );

            angle += parseFloat( configUI.angle );

            return true;
        }

        var currFrame = -1;

        function pingPongFrame( nv ) {

            if ( currFrame === nv.getFrameStamp().getFrameNumber() ) {
                console.log( 'double Frame' );
                return;
            }
            currFrame = nv.getFrameStamp().getFrameNumber();


            if ( configUI.rotate ) {
                rotateNode( nv );
            }

            /*            if ( frameNum > 64 ) {
                            halton[ 2 ] = 0.0;
                            uniforms.halton.dirty();
                            return;
                        }
            */

            updateUniforms();

            if ( !cameraRttAA0 || !cameraFinal ) {
                return;
            }

            // superSample PingPong
            if ( cameraRttAA0.getNodeMask() === ~0x0 ) {
                cameraRttAA0.setNodeMask( 0x0 );
                cameraRttAA1.setNodeMask( ~0x0 );

                if ( configUI.clearColor ) {
                    cameraRttAA0.setClearMask( osg.Camera.COLOR_BUFFER_BIT );
                    cameraRttAA0.setClearColor( [ 0.0, 1.0, 0.0, 1.0 ] );

                    //cameraRttAA1.setClearMask( 0 );
                }

            } else {
                cameraRttAA0.setNodeMask( ~0x0 );
                cameraRttAA1.setNodeMask( 0x0 );

                if ( configUI.clearColor ) {
                    cameraRttAA1.setClearColor( [ 1.0, 0.0, 0.0, 1.0 ] );
                    cameraRttAA1.setClearMask( osg.Camera.COLOR_BUFFER_BIT );

                    //cameraRttAA0.setClearMask( 0 );
                }
            }

        }


        function createComposer( sceneRTT ) {
            var composer = new osgUtil.Composer();
            composer.setName( 'supersample composer' );

            // previous Destination
            rttAA1 = createTextureRTT( 'antialias2',
                filterCheck,
                osg.Texture.UNSIGNED_BYTE );
            rttsArray.push( rttAA1 );
            cameraRttAA1 = createCameraRTT( rttAA1, false );


            //current Destination
            rttAA0 = createTextureRTT( 'antiAlias1',
                filterCheck,
                osg.Texture.UNSIGNED_BYTE );
            rttsArray.push( rttAA0 );
            var fragmentShader = shaderProcessor.getShader( 'supersample.glsl' );


            var uniform;
            // now Construct Super Sample Filter
            var aaFilter = new osgUtil.Composer.Filter.Custom( fragmentShader, uniforms );
            // previous render Texture + current Scene RTT
            aaFilter.getStateSet().setTextureAttributeAndModes( 0, sceneRTT );
            uniform = osg.Uniform.createInt1( 0, 'Texture0' );
            aaFilter.getStateSet().addUniform( uniform );

            aaFilter.getStateSet().setTextureAttributeAndModes( 1, rttAA1 );
            uniform = osg.Uniform.createInt1( 1, 'Texture1' );
            aaFilter.getStateSet().addUniform( uniform );

            // current render texture
            aaFilter = composer.addPass( aaFilter, rttAA0 );
            aaFilter.setFragmentName( 'SuperSample' );

            // basic Pass through
            // "Backup Final Pass" to a Destination Texture we save for next render
            // (Otherwise previous "supersample" pass above
            // would render into screen FrameBuffer,
            // thus next frame wouldn't be able to read from it
            //(screen frame buffer read is "undefined" by spec (triple/double buffer things)))
            //
            // To avoid ping pong on this one,
            // we use shader to do the read ping pong
            fragmentShader = shaderProcessor.getShader( 'passthrough.glsl' );

            rttFinal = createTextureRTT( 'Final',
                filterCheck,
                osg.Texture.UNSIGNED_BYTE );
            rttsArray.push( rttFinal );


            var passThroughFilter = new osgUtil.Composer.Filter.Custom( fragmentShader, uniforms );

            passThroughFilter.getStateSet().setTextureAttributeAndModes( 0, rttAA0 );
            uniform = osg.Uniform.createInt1( 0, 'Texture0' );
            passThroughFilter.getStateSet().addUniform( uniform );


            passThroughFilter.getStateSet().setTextureAttributeAndModes( 1, rttAA1 );
            uniform = osg.Uniform.createInt1( 1, 'Texture1' );
            passThroughFilter.getStateSet().addUniform( uniform );

            passThroughFilter.getStateSet().setTextureAttributeAndModes( 2, rttScene );
            uniform = osg.Uniform.createInt1( 2, 'Texture2' );
            passThroughFilter.getStateSet().addUniform( uniform );

            passThroughFilter = composer.addPass( passThroughFilter, rttFinal );
            passThroughFilter.setFragmentName( 'PassThrough' );



            //            composer.renderToScreen( canvas.width, canvas.height );
            composer.build();

            passThroughFilter.getStateSet().setName( 'passthrough' );

            prepCamerasForComposerFilterPingPong( composer );
            return composer;
        }

        function prepCamerasForComposerFilterPingPong( composer ) {

            // SUPERSAMPLE

            ////////////////////////
            // High level:
            // we need to render in a framebuffer using previous framebuffer render as input.

            ////////////////////////
            // Composer level:
            // what we want is to be able to switch texture input/output on a composer filter
            /*
             Frame A
                Filter Texture input RTTAA0
                Filter Texture output RTTAA1

             Frame B
                Filter Texture input RTTAA0
                Filter Texture output RTTAA1
             */

            ////////////////////////
            // What we do here is:
            // - clone a filter CameraRTTAA0 into CameraRTTAA1
            // - clone CameraRTTAA0 stateSet into CameraRTTAA1 stateset
            //
            // Then we can do:
            // - change cameraRTTAA1 stateset to use cameraRTTAA0 ouput texture RTTAA0
            // - change cameraRTTAA1 output to texture RTTAA1
            // - change cameraRTTAA0 input  to texture RTTAA0
            // - feed RTTAAA0 and RTTAA1 to CameraFinal that will render to Screen FrameBuffer
            //
            // And reorder composer children, making sure cameraRTT1 is just after cameraRTT0 and
            // both before CameraFinal
            // (otherwise you can end with cameraRTT1 after all other composer filter in draw order.)
            // For reorder we remove filter after cameraRTT0, add cameraRTT1 and then re-add CameraFinal
            // (in composer children list order)
            //
            // With this setup we will be able to switch alternatively each frame
            // cameraRTTAA0 and cameraRTTAA1 just using nodeMask



            /////////////////
            // Fist Step:
            // get a pointer to CameraRTTAAO so that we can switch camera later On
            // get a pointer to CameraFinal so that we can reorder compsoser children

            var children = composer.getChildren();
            for ( var i = 0, l = children.length; i < l; i++ ) {
                var node = children[ i ];
                if ( node.getAttachments ) {
                    var entry = Object.keys( node.getAttachments() );
                    if ( entry && entry.length > 0 ) {
                        var tex = node.getAttachments()[ entry[ 0 ] ][ 'texture' ];
                        if ( tex ) {
                            console.log( tex.getName() );
                            if ( tex.getName().indexOf( 'antiAlias1' ) === 0 ) {
                                cameraRttAA0 = node;

                            } else if ( tex.getName().indexOf( 'Final' ) === 0 ) {
                                cameraFinal = node;

                            }

                        }
                    }
                    /*else {
                        // no renderTarget it's the final Pass
                        // to RETEST once working not on final
                        cameraFinal = node;
                    }*/

                }
            }

            if ( cameraRttAA0 && cameraFinal ) {

                /////////////////
                // Second Step:
                // Clone CameraRTTAA0 into cameraRTTAA1
                // Clone CameraRTTAA1 StateSet into cameraRTTAA1 StateSet


                // stateset copy but for texture inversion
                var stInCurrent = cameraRttAA0.getOrCreateStateSet();
                stInCurrent.setName( 'state rtt aa 0' );
                var stInPrev = cameraRttAA1.getOrCreateStateSet();
                stInPrev.setName( 'state rtt aa 1' );

                console.assert( stInCurrent !== stInPrev );


                var attributes = stInCurrent.getAttributeMap().getKeys();
                for ( i = 0; i < attributes.length; i++ ) {
                    stInPrev.setAttributeAndModes( stInCurrent.getAttribute( attributes[ i ] ) );
                }

                var uniforms = stInCurrent.getUniformList().getKeys();
                for ( i = 0; i < uniforms.length; i++ ) {
                    stInPrev.addUniform( stInCurrent.getUniform( uniforms[ i ] ) );
                }


                // DO not copy texture, add our own textures
                stInPrev.setTextureAttributeAndModes( 0, stInCurrent.getTextureAttribute( 0, 'Texture' ) );
                stInPrev.setTextureAttributeAndModes( 1, rttAA0 );

                // camera copy
                // copy  everything in cameraRTT0 into cameraRTT1
                // (should only be the fullscreen quad)
                children = cameraRttAA0.getChildren();
                for ( i = 0, l = children.length; i < l; i++ ) {
                    cameraRttAA1.addChild( children[ i ] );
                }

                var vp = new osg.Viewport( 0, 0, cameraRttAA0.getViewport().width(), cameraRttAA0.getViewport().height() );
                cameraRttAA1.setViewport( vp );

                cameraRttAA1.setProjectionMatrix( cameraRttAA0.getProjectionMatrix() );
                cameraRttAA1.setViewMatrix( cameraRttAA0.getViewMatrix() );
                cameraRttAA1.setClearColor( cameraRttAA0.getClearColor() );
                cameraRttAA1.setClearDepth( cameraRttAA0.getClearDepth() );
                cameraRttAA1.setClearMask( cameraRttAA0.getClearMask() );
                cameraRttAA1.setRenderOrder( cameraRttAA0.getRenderOrder() );
                cameraRttAA1.setReferenceFrame( cameraRttAA0.getReferenceFrame() );

                ////////
                // ASSERT on no surprises
                // making double sure.
                // Check everything is setup correctly
                // check cameras
                console.assert( cameraRttAA0 === composer.getChildren()[ 0 ] );
                console.assert( cameraRttAA1 === composer.getChildren()[ 1 ] );
                console.assert( cameraFinal === composer.getChildren()[ 2 ] );

                //check textures
                var testTexture;

                // switch camera ping pong 0
                testTexture = stInCurrent.getTextureAttribute( 0, 'Texture' );
                console.assert( testTexture === rttScene );

                testTexture = stInCurrent.getTextureAttribute( 1, 'Texture' );
                console.assert( testTexture === rttAA1 );

                // switch camera ping pong 1
                testTexture = stInPrev.getTextureAttribute( 0, 'Texture' );
                console.assert( testTexture === rttScene );

                testTexture = stInPrev.getTextureAttribute( 1, 'Texture' );
                console.assert( testTexture === rttAA0 );

                // Final Camera, both result
                testTexture = cameraFinal.getOrCreateStateSet().getTextureAttribute( 0, 'Texture' );
                console.assert( testTexture === rttAA0 );

                testTexture = cameraFinal.getOrCreateStateSet().getTextureAttribute( 1, 'Texture' );
                console.assert( testTexture === rttAA1 );
                ///////// End ASSERT


                // reorder to get correct draw Order
                // making sure CameraFinal is the latest in order.
                composer.removeChild( cameraFinal );
                composer.addChild( cameraRttAA1 );
                composer.addChild( cameraFinal );

                // hide one of the two pass, as we will render only one each frame
                cameraRttAA1.setNodeMask( ~0x0 );

            }
            /////////////////
        }

        function readShaders() {

            shaderProcessor = new osgShader.ShaderProcessor();

            var defer = P.defer();

            var shaderNames = [
                'supersample.glsl',
                'passthrough.glsl',
            ];


            var shaders = shaderNames.map( function ( arg ) {
                return arg;
            } );


            var promises = [];
            shaders.forEach( function ( shader ) {
                promises.push( P.resolve( $.get( shader ) ) );
            } );

            P.all( promises ).then( function ( args ) {

                var shaderNameContent = {};
                shaderNames.forEach( function ( name, idx ) {
                    shaderNameContent[ name ] = args[ idx ];
                } );

                shaderProcessor.addShaders( shaderNameContent );

                defer.resolve();

            } );

            return defer.promise;
        }


        function installCustomShaders() {


            // create a new shader generator with our own compiler
            var shaderGenerator = new osgShader.ShaderGenerator();
            shaderGenerator.setShaderCompiler( CustomCompiler );
            // make the ShaderGenerator accept new Attributes
            shaderGenerator.getAcceptAttributeTypes().add( 'Temporal' );

            // get or create instance of ShaderGeneratorProxy
            var shaderGeneratorProxy = viewer.getState().getShaderGeneratorProxy();
            shaderGeneratorProxy.addShaderGenerator( 'custom', shaderGenerator );

            // now we can use 'custom' in StateSet to access our shader generator

        }

        canvas = document.getElementById( 'View' );

        var manipulator;

        viewer = new osgViewer.Viewer( canvas, {
            antialias: true,
            alpha: true
        } );
        viewer.init();


        if ( manipulator ) viewer.setupManipulator( manipulator );
        else viewer.setupManipulator();

        viewer.setLightingMode( osgViewer.View.LightingMode.NO_LIGHT );

        var temporalAttribute;
        installCustomShaders();
        temporalAttribute = new TemporalAttribute();

        rotate = new osg.MatrixTransform();
        rotate.addChild( createScene() );
        rotate._lastUpdate = 0.0;

        var root = new osg.Node();

        // rotating cube  scene
        var rttScene = createTextureRTT( 'sceneRTT',
            filterCheck,
            osg.Texture.UNSIGNED_BYTE );

        rttsArray.push( rttScene );


        var cameraScene = createCameraRTT( rttScene, true );
        cameraScene.addChild( rotate );
        //        cameraScene.setComputeNearFar( false );
        var m = cameraScene.getViewMatrix();

        osg.Matrix.makeRotate( -90, 0.0, 1.0, 0.0, m );


        cameraScene.setViewMatrix( m );


        // composer scene
        if ( temporalAttribute ) {
            halton = [ 0.0, 0.0, 0.0, 0.0 ];
            var renderSize = [ canvas.width, canvas.height ];
            uniforms = {
                halton: osg.Uniform.createFloat4( halton, 'halton' ),
                RenderSize: osg.Uniform.createFloat2( renderSize, 'RenderSize' )
            };

            root.getOrCreateStateSet().addUniform( uniforms.halton );
            root.getOrCreateStateSet().addUniform( uniforms.RenderSize );

            temporalAttribute.setAttributeEnable( true );
            rotate.getOrCreateStateSet().setAttributeAndModes( temporalAttribute );
            rotate.getOrCreateStateSet().setShaderGeneratorName( 'custom' );
        }

        // debug Scene
        rttDebugNode = new osg.Node();

        // final Quad
        var quadSize = [ 16 * 16 / 9, 16 * 1 ];
        quad = osg.createTexturedQuadGeometry( -quadSize[ 0 ] / 2.0, 0, -quadSize[ 1 ] / 2.0,
            quadSize[ 0 ], 0, 0,
            0, 0, quadSize[ 1 ] );


        readShaders().then( function () {

            var composer;

            composer = createComposer( rttScene );

            var nodeCompo = new osg.Node();
            nodeCompo.addChild( composer );
            quad.getOrCreateStateSet().setTextureAttributeAndModes( 0, rttFinal );
            quad.getOrCreateStateSet().setAttributeAndModes( new osg.CullFace( 'DISABLE' ) );

            // add in correct order !
            root.addChild( cameraScene );
            root.addChild( nodeCompo );

            root.addChild( quad );
            root.addChild( rttDebugNode );


            viewer.getCamera().setClearColor( [ 0.0, 0.0, 0.0, 0.0 ] );
            //viewer.getCamera().setClearMask( 0 );
            viewer.setSceneData( root );


            configUI = {
                rotate: false,
                debug: false,
                clearColor: false,
                supersample: false,
                angle: 0.01,
                motionblur: false,
                showScene: false,
                // start/stop AA accumulation
                enableSuperSample: function () {
                    if ( this.supersample ) {
                        frameNum = 1;
                        halton[ 2 ] = 1.0;

                    } else {
                        //disable
                        frameNum = 1;
                        halton[ 2 ] = 0.0;
                    }
                    uniforms.halton.dirty();
                },
                // start/stop motion blur accumulation
                enableMotionBlur: function () {
                    if ( this.motionblur ) {
                        frameNum = 1;
                        halton[ 2 ] = 2.0;

                    } else {
                        //disable
                        frameNum = 1;
                        halton[ 2 ] = 0.0;
                    }
                    uniforms.halton.dirty();
                },
                // show the framebuffers as ui quad on left bottom screen
                debugFunc: function () {
                    if ( rttDebugNode.getChildren().length !== 0 ) {
                        rttDebugNode.removeChildren();
                        return;
                    } else {
                        rttDebugNode.setName( '_rttDebugNode' );
                    }
                    showFrameBuffers( {
                        screenW: canvas.width,
                        screenH: canvas.height
                    } );

                },
                // debug color per RTT
                clearColorFunc: function () {
                    if ( !this.clearColor ) {
                        cameraRttAA0.setClearMask( 0 );
                        cameraRttAA0.setClearColor( [ 0.0, 0.0, 1.0, 1.0 ] );
                        cameraRttAA1.setClearMask( 0 );
                        cameraRttAA1.setClearColor( [ 0.0, 0.0, 1.0, 1.0 ] );
                    }
                },
                // make sure the input Scene RTT is OK
                // Doesn't show other RTT, could be a droplist...
                showSceneFunc: function () {
                    if ( this.showScene ) quad.getOrCreateStateSet().setTextureAttributeAndModes( 0, rttScene );
                    else quad.getOrCreateStateSet().setTextureAttributeAndModes( 0, rttFinal );
                }
            };
            var controller;
            var gui = new window.dat.GUI();

            controller = gui.add( configUI, 'rotate' );
            controller = gui.add( configUI, 'supersample' );
            controller.onChange( configUI.enableSuperSample.bind( configUI ) );
            controller = gui.add( configUI, 'motionblur' );
            controller.onChange( configUI.enableMotionBlur.bind( configUI ) );
            controller = gui.add( configUI, 'debug' );
            controller.onChange( configUI.debugFunc.bind( configUI ) );
            controller = gui.add( configUI, 'clearColor' );
            controller.onChange( configUI.clearColorFunc.bind( configUI ) );
            controller = gui.add( configUI, 'showScene' );
            controller.onChange( configUI.showSceneFunc.bind( configUI ) );
            controller = gui.add( configUI, 'angle', 0.0, 1.0 );


            var camera = viewer.getCamera();
            camera.setName( 'scene' );

            camera.setComputeNearFar( false );

            manipulator = viewer.getManipulator();
            manipulator.computeHomePosition();
            // manipulate inside the RTT
            //manipulator.setNode( rotate );
            //manipulator.setCamera( cameraScene );
            //manipulator.computeHomePosition();

            manipulator.setNode( quad );

            manipulator.oldUp = manipulator.update;
            manipulator.update = function ( nv ) {
                pingPongFrame( nv );
                manipulator.oldUp( nv );
            };

            viewer.run();
        } );
    };

    window.addEventListener( 'load', main, true );

} )();
