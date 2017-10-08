/*--------------------------------------------------------------------------

tesseract-compute-shaders

The MIT License (MIT)

Copyright (c) 2017 Haydn Paterson (sinclair) <haydn.developer@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

---------------------------------------------------------------------------*/

export const demo_javascript = () => `const start = Date.now()
const time  = () => (Date.now() - start) * 0.001

function resolve() {
  return {
    iGlobalTime: time()
  }
}
`

export const demo_shader = () => `/**
* Created by Kamil Kolaczynski (revers) - 2016
*
* Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
*
* This shader, as always, uses a lot of code (raymarching, noise and lighting) 
* credited to iq  [ https://www.shadertoy.com/view/Xds3zN ]. 
* Camera path is based on Shane's "Subterranean Fly-Through" 
* [ https://www.shadertoy.com/view/XlXXWj ].
* Additional specular lighting trick is based on "Wet stone" by TDM 
* [ https://www.shadertoy.com/view/ldSSzV ].
* Thanks for sharing great code guys!
* The shader was created and exported from Synthclipse 
* [ http://synthclipse.sourceforge.net/ ].
*/

uniform float iGlobalTime;

const float FOV = 0.4;
const float MarchDumping = 0.7579;
const float Far = 38.925;
const int MaxSteps = 128;
const float CameraSpeed = 4.5099998;
const float TunnelSmoothFactor = 2.0;
const float TunnelRadius = 0.85660005;
const float TunnelFreqA = 0.18003;
const float TunnelFreqB = 0.25;
const float TunnelAmpA = 3.6230998;
const float TunnelAmpB = 2.4324;
const float NoiseIsoline = 0.319;
const float NoiseScale = 2.9980001;
const vec3 Color = vec3(0.85, 0.68, 0.4);

#define M_NONE -1.0
#define M_NOISE 1.0

float hash(float h) {
 return fract(sin(h) * 43758.5453123);
}

float noise(vec3 x) {
 vec3 p = floor(x);
 vec3 f = fract(x);
 f = f * f * (3.0 - 2.0 * f);

 float n = p.x + p.y * 157.0 + 113.0 * p.z;
 return mix(
     mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
         mix(hash(n + 157.0), hash(n + 158.0), f.x), f.y),
     mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
         mix(hash(n + 270.0), hash(n + 271.0), f.x), f.y), f.z);
}

float fbm(vec3 p) {
 float f = 0.0;
 f = 0.5000 * noise(p);
 p *= 2.01;
 f += 0.2500 * noise(p);
 p *= 2.02;
 f += 0.1250 * noise(p);

 return f;
}

// by iq. http://iquilezles.org/www/articles/smin/smin.htm
float smax(float a, float b, float k) {
 float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
 return mix(a, b, h) + k * h * (1.0 - h);
}

// From "Subterranean Fly-Through" by Shane https://www.shadertoy.com/view/XlXXWj
vec2 path(float z) {
 return vec2(TunnelAmpA * sin(z * TunnelFreqA), TunnelAmpB * cos(z * TunnelFreqB));
}

float noiseDist(vec3 p) {
 p = p / NoiseScale;
 return (fbm(p) - NoiseIsoline) * NoiseScale;
}

vec2 map(vec3 p) {
 float d = noiseDist(p);
 float d2 = length(p.xy - path(p.z)) - TunnelRadius;
 d = smax(d, -d2, TunnelSmoothFactor);

 vec2 res = vec2(d, M_NOISE);
 return res;
}

vec2 castRay(vec3 ro, vec3 rd) {
 float tmin = 0.0;
 float tmax = Far;

 float precis = 0.002;
 float t = tmin;
 float m = M_NONE;

 for (int i = 0; i < MaxSteps; i++) {
   vec2 res = map(ro + rd * t);
   if (res.x < precis || t > tmax) {
     break;
   }
   t += res.x * MarchDumping;
   m = res.y;
 }
 if (t > tmax) {
   m = M_NONE;
 }
 return vec2(t, m);
}

float softshadow(vec3 ro, vec3 rd, float mint, float tmax) {
 float res = 1.0;
 float t = mint;
 for (int i = 0; i < 16; i++) {
   float h = map(ro + rd * t).x;
   res = min(res, 8.0 * h / t);
   t += clamp(h, 0.02, 0.10);

   if (h < 0.001 || t > tmax) {
     break;
   }
 }
 return clamp(res, 0.0, 1.0);
}

vec3 calcNormal(vec3 pos) {
 vec2 eps = vec2(0.001, 0.0);
 vec3 nor = vec3(map(pos + eps.xyy).x - map(pos - eps.xyy).x,
     map(pos + eps.yxy).x - map(pos - eps.yxy).x,
     map(pos + eps.yyx).x - map(pos - eps.yyx).x);
 return normalize(nor);
}

float calcAO(vec3 pos, vec3 nor) {
 float occ = 0.0;
 float sca = 1.0;

 for (int i = 0; i < 5; i++) {
   float hr = 0.01 + 0.12 * float(i) / 4.0;
   vec3 aopos = nor * hr + pos;
   float dd = map(aopos).x;

   occ += -(dd - hr) * sca;
   sca *= 0.95;
 }
 return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

vec3 render(vec3 ro, vec3 rd) {
 vec3 col = vec3(0.0);
 vec2 res = castRay(ro, rd);
 float t = res.x;
 float m = res.y;

 if (m > -0.5) {
   vec3 pos = ro + t * rd;
   vec3 nor = calcNormal(pos);

   // material
   col = Color + sin(t * 0.8) * 0.3;
   col += 0.3 * sin(vec3(0.15, 0.02, 0.10) * iGlobalTime * 6.0);

   // lighitng
   float occ = calcAO(pos, nor);
   vec3 lig = -rd;
   float amb = clamp(0.5 + 0.5 * nor.y, 0.0, 1.0);
   float dif = clamp(dot(nor, lig), 0.0, 1.0);

   float fre = pow(clamp(1.0 + dot(nor, rd), 0.0, 1.0), 2.0);

   vec3 ref = reflect(rd, nor);
   float spe = pow(clamp(dot(ref, lig), 0.0, 1.0), 100.0);

   dif *= softshadow(pos, lig, 0.02, 2.5);

   vec3 brdf = vec3(0.0);
   brdf += 1.20 * dif * vec3(1.00, 0.90, 0.60);
   brdf += 1.20 * spe * vec3(1.00, 0.90, 0.60) * dif;

   // Additional specular lighting trick,
   // taken from "Wet stone" by TDM
   // https://www.shadertoy.com/view/ldSSzV
   nor = normalize(nor - normalize(pos) * 0.2);
   ref = reflect(rd, nor);
   spe = pow(clamp(dot(ref, lig), 0.0, 1.0), 100.0);
   brdf += 2.20 * spe * vec3(1.00, 0.90, 0.60) * dif;

   brdf += 0.40 * amb * vec3(0.50, 0.70, 1.00) * occ;
   brdf += 0.40 * fre * vec3(1.00, 1.00, 1.00) * occ;

   col = col * brdf;

   col = mix(col, vec3(0.0), 1.0 - exp(-0.005 * t * t));
 }
 return vec3(clamp(col, 0.0, 1.0));
}

mat3 rotationZ(float a) {
 float sa = sin(a);
 float ca = cos(a);

 return mat3(ca, sa, 0.0, -sa, ca, 0.0, 0.0, 0.0, 1.0);
}

vec4 output0(int x, int y) {
 vec2 iResolution = vec2(float(thread.width), float(thread.height));
 vec2 fragCoord   = vec2(float(x), float(y));
 float t = iGlobalTime;
 vec2 r = iResolution;
 vec3 c;
 float l,z=t;
 for(int i=0;i<3;i++) {
   vec2 uv,p=fragCoord.xy/r;
   uv=p;
   p-=.5;
   p.x*=r.x/r.y;
   z+=.07;
   l=length(p);
   uv+=p/l*(sin(z)+1.)*abs(sin(l*9.-z*2.));
   c[i]=.01/length(abs(mod(uv,1.)-.5));
 }
 return vec4(c/l,t);
}

vec4 output1(int x, int y) {
 vec2 iResolution = vec2(float(thread.width), float(thread.height));
 vec2 fragCoord      = vec2(float(x), float(y));
 vec2 q = fragCoord / iResolution.xy;
 vec2 coord = 2.0 * q - 1.0;
 coord.x *= iResolution.x / iResolution.y;
 coord *= FOV;

 float t = iGlobalTime * CameraSpeed + 4.0 * 60.0;
 vec3 ro = vec3(path(t), t);

 t += 0.5;
 vec3 target = vec3(path(t), t);
 vec3 dir = normalize(target - ro);
 vec3 up = vec3(-0.9309864, -0.33987653, 0.1332234) * rotationZ(iGlobalTime * 0.05);
 vec3 upOrtho = normalize(up - dot(dir, up) * dir);
 vec3 right = normalize(cross(dir, upOrtho));

 vec3 rd = normalize(dir + coord.x * right + coord.y * upOrtho);

 vec3 col = render(ro, rd);

 col = pow(col, vec3(0.4545));

 return vec4(col, 1.0);
}

[color] thread(int x, int y) {
  thread[0] = output1(x, y);
}

`
export const water_demo_javascript = () => `const start = Date.now()
const time  = () => (Date.now() - start) * 0.001

function resolve() {
  return {
    iTime: time(),
    iMouse: [1, 1]
  }
}
`
export const water_demo_shader = () => `/*
* "Seascape" by Alexander Alekseev aka TDM - 2014
* License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
* Contact: tdmaav@gmail.com
* 
* original work: https://www.shadertoy.com/view/Ms2SD1
*/

uniform float iTime;
uniform vec2 iMouse;

const int NUM_STEPS = 8;
const float PI	 	= 3.141592;
const float EPSILON	= 1e-3;
#define EPSILON_NRM (0.1 / float(thread.width))

// sea
const int ITER_GEOMETRY    = 3;
const int ITER_FRAGMENT    = 5;
const float SEA_HEIGHT     = 0.6;
const float SEA_CHOPPY     = 4.0;
const float SEA_SPEED      = 0.8;
const float SEA_FREQ       = 0.16;
const vec3 SEA_BASE        = vec3(0.1,0.19,0.22);
const vec3 SEA_WATER_COLOR = vec3(0.8,0.9,0.6);
#define SEA_TIME (1.0 + iTime * SEA_SPEED)
const mat2 octave_m = mat2(1.6,1.2,-1.2,1.6);

// math
mat3 fromEuler(vec3 ang) {
 vec2 a1 = vec2(sin(ang.x),cos(ang.x));
   vec2 a2 = vec2(sin(ang.y),cos(ang.y));
   vec2 a3 = vec2(sin(ang.z),cos(ang.z));
   mat3 m;
   m[0] = vec3(a1.y*a3.y+a1.x*a2.x*a3.x,a1.y*a2.x*a3.x+a3.y*a1.x,-a2.y*a3.x);
 m[1] = vec3(-a2.y*a1.x,a1.y*a2.y,a2.x);
 m[2] = vec3(a3.y*a1.x*a2.x+a1.y*a3.x,a1.x*a3.x-a1.y*a3.y*a2.x,a2.y*a3.y);
 return m;
}
float hash( vec2 p ) {
 float h = dot(p,vec2(127.1,311.7));	
   return fract(sin(h)*43758.5453123);
}
float noise( in vec2 p ) {
   vec2 i = floor( p );
   vec2 f = fract( p );	
 vec2 u = f*f*(3.0-2.0*f);
   return -1.0+2.0*mix( mix( hash( i + vec2(0.0,0.0) ), 
                    hash( i + vec2(1.0,0.0) ), u.x),
               mix( hash( i + vec2(0.0,1.0) ), 
                    hash( i + vec2(1.0,1.0) ), u.x), u.y);
}

// lighting
float diffuse(vec3 n,vec3 l,float p) {
   return pow(dot(n,l) * 0.4 + 0.6,p);
}
float specular(vec3 n,vec3 l,vec3 e,float s) {    
   float nrm = (s + 8.0) / (PI * 8.0);
   return pow(max(dot(reflect(e,n),l),0.0),s) * nrm;
}

// sky
vec3 getSkyColor(vec3 e) {
   e.y = max(e.y,0.0);
   return vec3(pow(1.0-e.y,2.0), 1.0-e.y, 0.6+(1.0-e.y)*0.4);
}

// sea
float sea_octave(vec2 uv, float choppy) {
   uv += noise(uv);        
   vec2 wv = 1.0-abs(sin(uv));
   vec2 swv = abs(cos(uv));    
   wv = mix(wv,swv,wv);
   return pow(1.0-pow(wv.x * wv.y,0.65),choppy);
}

float map(vec3 p) {
   float freq = SEA_FREQ;
   float amp = SEA_HEIGHT;
   float choppy = SEA_CHOPPY;
   vec2 uv = p.xz; uv.x *= 0.75;
   
   float d, h = 0.0;    
   for(int i = 0; i < ITER_GEOMETRY; i++) {        
     d = sea_octave((uv+SEA_TIME)*freq,choppy);
     d += sea_octave((uv-SEA_TIME)*freq,choppy);
       h += d * amp;        
     uv *= octave_m; freq *= 1.9; amp *= 0.22;
       choppy = mix(choppy,1.0,0.2);
   }
   return p.y - h;
}

float map_detailed(vec3 p) {
   float freq = SEA_FREQ;
   float amp = SEA_HEIGHT;
   float choppy = SEA_CHOPPY;
   vec2 uv = p.xz; uv.x *= 0.75;
   
   float d, h = 0.0;    
   for(int i = 0; i < ITER_FRAGMENT; i++) {        
     d = sea_octave((uv+SEA_TIME)*freq,choppy);
     d += sea_octave((uv-SEA_TIME)*freq,choppy);
       h += d * amp;        
     uv *= octave_m; freq *= 1.9; amp *= 0.22;
       choppy = mix(choppy,1.0,0.2);
   }
   return p.y - h;
}

vec3 getSeaColor(vec3 p, vec3 n, vec3 l, vec3 eye, vec3 dist) {  
   float fresnel = clamp(1.0 - dot(n,-eye), 0.0, 1.0);
   fresnel = pow(fresnel,3.0) * 0.65;
       
   vec3 reflected = getSkyColor(reflect(eye,n));    
   vec3 refracted = SEA_BASE + diffuse(n,l,80.0) * SEA_WATER_COLOR * 0.12; 
   
   vec3 color = mix(refracted,reflected,fresnel);
   
   float atten = max(1.0 - dot(dist,dist) * 0.001, 0.0);
   color += SEA_WATER_COLOR * (p.y - SEA_HEIGHT) * 0.18 * atten;
   
   color += vec3(specular(n,l,eye,60.0));
   
   return color;
}

// tracing
vec3 getNormal(vec3 p, float eps) {
   vec3 n;
   n.y = map_detailed(p);    
   n.x = map_detailed(vec3(p.x+eps,p.y,p.z)) - n.y;
   n.z = map_detailed(vec3(p.x,p.y,p.z+eps)) - n.y;
   n.y = eps;
   return normalize(n);
}

float heightMapTracing(vec3 ori, vec3 dir, out vec3 p) {  
   float tm = 0.0;
   float tx = 1000.0;    
   float hx = map(ori + dir * tx);
   if(hx > 0.0) return tx;   
   float hm = map(ori + dir * tm);    
   float tmid = 0.0;
   for(int i = 0; i < NUM_STEPS; i++) {
       tmid = mix(tm,tx, hm/(hm-hx));                   
       p = ori + dir * tmid;                   
     float hmid = map(p);
   if(hmid < 0.0) {
         tx = tmid;
           hx = hmid;
       } else {
           tm = tmid;
           hm = hmid;
       }
   }
   return tmid;
}

// main
[color] thread(int x, int y) {
   vec2 uv = vec2(
     float(x) / float(thread.width),
     float(y) / float(thread.height)
   );
   uv = uv * 2.0 - 1.0;
   uv.y = -(uv.y + .3);
   float time = iTime * 0.3 + iMouse.x*0.01;
       
   // ray
   vec3 ang = vec3(sin(time*3.0)*0.1,sin(time)*0.2+0.3,time);    
   vec3 ori = vec3(0.0,3.5,time*5.0);
   vec3 dir = normalize(vec3(uv.xy,-2.0)); dir.z += length(uv) * 0.15;
   dir = normalize(dir) * fromEuler(ang);
   
   // tracing
   vec3 p;
   heightMapTracing(ori,dir,p);
   vec3 dist = p - ori;
   vec3 n = getNormal(p, dot(dist,dist) * EPSILON_NRM);
   vec3 light = normalize(vec3(0.0,1.0,0.8)); 
            
   // color
   vec3 color = mix(
       getSkyColor(dir),
       getSeaColor(p,n,light,dir,dist),
     pow(smoothstep(0.0,-0.05,dir.y),0.3));
       
   // post
 thread[0] = vec4(pow(color,vec3(0.75)), 1.0);
}


`