
varying vec2 FragTexCoord0;
uniform vec2 RenderSize;
uniform sampler2D Texture0;
uniform sampler2D Texture1;
uniform sampler2D Texture2;
uniform vec4 halton;

void main()
{
    vec4 superSampleResult = (mod(halton[3], 2.0) == 0.0) ? texture2D(Texture0, FragTexCoord0) : texture2D(Texture1, FragTexCoord0);

    gl_FragColor = superSampleResult;

//DEBUG
/*
    if (FragTexCoord0.y > 0.5){

        gl_FragColor.xyz = (superSampleResult.xyz - texture2D(Texture2, FragTexCoord0).xyz) * 10.0 ;

    }
*/
//    gl_FragColor = FragTexCoord0.x > 0.5 ? texture2D(Texture0, FragTexCoord0)  : texture2D(Texture1, FragTexCoord0);
//    if (FragTexCoord0.x > 0.49 && FragTexCoord0.x < .51) gl_FragColor += vec4( 5.0, 0.0, 0.0, 0.0);
}
