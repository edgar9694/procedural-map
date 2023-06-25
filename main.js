// course from https://www.youtube.com/playlist?list=PLWP0narTpO8lAmalqspXgv-x1pq9CHnvR

import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader'
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils'
import { createNoise2D } from 'simplex-noise';
import { DoubleSide } from 'three';

const renderer = new THREE.WebGL1Renderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
// these two lines make sure that the physical values computed by the render can be properly displayed on our monitor
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type =  THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene();

scene.background = new THREE.Color("#FFEECC");

const camera =  new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(-17,31,33);
// camera.position.set(0,0,50);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0,0,0);
controls.dampingFactor = 0.05;
controls.enableDamping = true

//convertSRGBToLinear make sure that the color is interpreted by a render by a proper physical color
const light = new THREE.PointLight(new THREE.Color("#FFCB8E").convertSRGBToLinear().convertSRGBToLinear(), 80, 200);
light.position.set(10, 20, 10);
light.castShadow = true;
light.shadow.mapSize.width = 512;
light.shadow.mapSize.height = 512;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 500;
scene.add(light)


let envmap;
const MAX_HEIGHT = 10;
const STONE_HEIGHT = MAX_HEIGHT * 0.8;
const DIRT_HEIGHT = MAX_HEIGHT * 0.7;
const GRASS_HEIGHT = MAX_HEIGHT * 0.5;
const SAND_HEIGHT = MAX_HEIGHT * 0.3;
const DIRT2_HEIGHT = MAX_HEIGHT * 0;


const animate = (async () =>{
    let pmrem = new THREE.PMREMGenerator(renderer);
    let envmapTexture = await new RGBELoader().setDataType(THREE.FloatType).loadAsync("./assets/envmap.hdr");
    envmap = pmrem.fromEquirectangular(envmapTexture).texture;
    const noise2D = createNoise2D();
    // const sphereGeometry = new THREE.SphereGeometry(5,10,10);
    // const sphereMaterial = new THREE.MeshStandardMaterial({
    //     envMap: envmap,
    //     roughness: 0,
    //     metalness: 1,
    // })
    // const sphereMesh = new THREE.Mesh(
    //     sphereGeometry,
    //     sphereMaterial    
    // );

    // scene.add(sphereMesh);  
    //loading textures
    let textures = {
        dirt: await new THREE.TextureLoader().loadAsync("./assets/dirt.png"),
        dirt2: await new THREE.TextureLoader().loadAsync("./assets/dirt2.jpg"),
        grass: await new THREE.TextureLoader().loadAsync("./assets/grass.jpg"),
        sand: await new THREE.TextureLoader().loadAsync("./assets/sand.jpg"),
        water: await new THREE.TextureLoader().loadAsync("./assets/water.jpg"),
        stone: await new THREE.TextureLoader().loadAsync("./assets/stone.png")
    }



    // generate the field of hexagons
    for (let i = -10; i <= 10; i++) {
        for (let j = -10; j <= 10; j++) {
            let position = tileToPosition(i,j);
            
            // limits the hexagon creation to a circunferencial area
            if(position.length() > 16) continue;
            
            //randomnly generate noise to the height of the hexagons
            let noise = (noise2D(i * 0.1 , j * 0.1) + 1 ) * 0.5;
            noise = Math.pow(noise, 1.5)
            
            makeHex(noise * MAX_HEIGHT, position)
        }
    
        
    }

    let stoneMesh = hexMesh(stoneGeo, textures.stone);
    let dirtMesh = hexMesh(dirtGeo, textures.dirt);
    let dirt2Mesh = hexMesh(dirt2Geo, textures.dirt2);
    let grassMesh = hexMesh(grassGeo, textures.grass);
    let sandMesh = hexMesh(sandGeo, textures.sand);
    scene.add(stoneMesh, dirtMesh, dirt2Mesh, grassMesh, sandMesh);

    // sea hexagon
    const seaGeo = new THREE.CylinderGeometry(17, 17, MAX_HEIGHT * 0.2, 50);
    const seaMat = new THREE.MeshPhysicalMaterial({
        envMap: envmap,
        color: new THREE.Color("#55aaff").convertSRGBToLinear().multiplyScalar(3),
        //these four properties helps the uee of transmission shader of three.js
        ior: 4.1,
        transmission: 1,
        transparent: true,
        thickness: 1.5,
        envMapIntensity: 0.2,
        roughness: 1,
        metalness: 0.025,
        roughnessMap: textures.water,
        metalnessMap: textures.water
    })
    let seaMesh = new THREE.Mesh(seaGeo, seaMat);
    seaMesh.position.set(0, MAX_HEIGHT * 0.1, 0);
    scene.add(seaMesh);

    // border container
    const mapGeo = new THREE.CylinderGeometry(17.1, 17.1, MAX_HEIGHT * 0.25, 50, 1, true);
    const mapMat = new THREE.MeshPhysicalMaterial({
        envMap: envmap,
        map: textures.dirt,
        envMapIntensity: 0.2,
        // this property is for threeJs to render the bakside of the object
        side: DoubleSide
    });
    const mapContainer = new THREE.Mesh(mapGeo, mapMat);
    mapContainer.receiveShadow = true;
    mapContainer.position.set(0, MAX_HEIGHT * 0.125, 0);
    scene.add(mapContainer);

    // floor
    const floorGeo = new THREE.CylinderGeometry(18.5, 18.5, MAX_HEIGHT * 0.1, 50);
    const floorMat = new THREE.MeshPhysicalMaterial({
        envMap: envmap,
        map: textures.dirt,
        envMapIntensity: 0.2,
        // this property is for threeJs to render the bakside of the object
        side: DoubleSide
    });
    const mapFloor = new THREE.Mesh(floorGeo, floorMat);
    mapFloor.receiveShadow = true;
    mapFloor.position.set(0, -MAX_HEIGHT * 0.05, 0);
    scene.add(mapFloor);

    cloud();

    renderer.setAnimationLoop( () =>{
        controls.update();
        renderer.render(scene, camera);
    });
})();


let stoneGeo = new THREE.BoxGeometry(0,0,0);
let dirtGeo = new THREE.BoxGeometry(0,0,0);
let dirt2Geo = new THREE.BoxGeometry(0,0,0);
let sandGeo = new THREE.BoxGeometry(0,0,0);
let grassGeo = new THREE.BoxGeometry(0,0,0);

// create the geometry
const hexGeometry = (height, position) =>{
    let geo = new THREE.CylinderGeometry(1,1,height,6,1,false);
    geo.translate(position.x, height*0.5, position.y)

    return geo;
}

// assing the geometry and the texture
const makeHex = (height, position) =>{
    let geo = hexGeometry(height, position);

    if(height > STONE_HEIGHT){
        stoneGeo = mergeBufferGeometries([geo,stoneGeo])
        if(Math.random() > 0.8){
            stoneGeo = mergeBufferGeometries([stoneGeo,stone(height, position)])
        }
    } else if ( height > DIRT_HEIGHT){
        dirtGeo = mergeBufferGeometries([geo,dirtGeo])

        if(Math.random() > 0.8 && grassGeo){
            grassGeo = mergeBufferGeometries([grassGeo,tree(height, position)])
        }
    } else if ( height > GRASS_HEIGHT){
        grassGeo = mergeBufferGeometries([geo,grassGeo])
    } else if ( height > SAND_HEIGHT){
        sandGeo = mergeBufferGeometries([geo,sandGeo])

        if(Math.random() > 0.8 && stoneGeo){
            stoneGeo = mergeBufferGeometries([stoneGeo,stone(height, position)])
        }
    } else if ( height > DIRT2_HEIGHT){
        dirt2Geo = mergeBufferGeometries([geo,dirt2Geo])
    }
}

// align the hexagons closely
const tileToPosition = (tileX, tileY) =>{
    return new THREE.Vector2((tileX + (tileY % 2) * 0.5) * 1.77, tileY * 1.535)
}

const hexMesh = (geo, map) =>{
    let mat = new THREE.MeshPhysicalMaterial({
        envMap: envmap,
        // envMapIntensity: 1,
        envMapIntensity: 0.135,
        flatShading: true,
        map
    });

    let mesh =  new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh
}


// create the stone
const stone = (height, position) => {
    const px = Math.random() * 0.4;
    const pz = Math.random() * 0.4;

    const geo = new THREE.SphereGeometry( Math.random() * 0.3 + 0.1, 7, 7)
    geo.translate(position.x + px, height, position.y + pz)

    return geo

}

//  create the tree
const tree = (height, position) =>{
    const treeHeight = Math.random() * 1 + 1.25;

    const geo = new THREE.CylinderGeometry(0, 1.5, treeHeight, 3);
    geo.translate(position.x, height + treeHeight * 0 + 1, position.y);
    
    const geo2 = new THREE.CylinderGeometry(0, 1.15, treeHeight, 3);
    geo2.translate(position.x, height + treeHeight * 0.6 + 1, position.y);
    
    const geo3 = new THREE.CylinderGeometry(0, 0.8, treeHeight, 3);
    geo3.translate(position.x, height + treeHeight * 1.25 + 1, position.y);

    return mergeBufferGeometries([geo, geo2, geo3])
}

const cloud = () => {
    let geo = new THREE.SphereGeometry(0,0,0);
    let count  =  Math.floor(Math.pow(Math.random(), 0.45) * 4);
    
    for (let i = 0; i < count; i++) {
        const puff1 = new THREE.SphereGeometry(1.2,7,7);
        const puff2 = new THREE.SphereGeometry(1.5,7,7);
        const puff3 = new THREE.SphereGeometry(0.9,7,7);

        puff1.translate(-1.85, Math.random() * 0.3, 0);
        puff2.translate(0, Math.random() * 0.3, 0);
        puff3.translate(1.85, Math.random() * 0.3, 0);

        const cloudGeo = mergeBufferGeometries([
            puff1,
            puff2,
            puff3
        ]);
        cloudGeo.translate(
            Math.random() * 20 - 10,
            Math.random() * 7 + 7,
            Math.random() * 20 -10
        )

        cloudGeo.rotateY(Math.random() * Math.PI * 2);

        geo = mergeBufferGeometries([geo, cloudGeo]);
    }


    const cloudMat = new THREE.MeshStandardMaterial({
        envMap: envmap,
        envMapIntensity: 0.75,
        flatShading: true
    })

    const cloudMesh = new THREE.Mesh(geo, cloudMat);
    scene.add(cloudMesh)
}


