import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Pathfinding, PathfindingHelper } from 'three-pathfinding';

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xB7E0FF);

// Get the map container
const mapContainer = document.getElementById('map-container') as HTMLDivElement;

// CAMERA
const camera = new THREE.PerspectiveCamera(45, mapContainer.clientWidth / mapContainer.clientHeight, 0.1, 1000);
camera.position.set(33, 10, 10);

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(mapContainer.clientWidth, mapContainer.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
mapContainer.appendChild(renderer.domElement);

// ORBIT CAMERA CONTROLS
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
};
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.1;
orbitControls.enablePan = true;
orbitControls.enableZoom = true;
orbitControls.minDistance = 5;
orbitControls.maxDistance = 500;
orbitControls.zoomSpeed = 1.2;
orbitControls.screenSpacePanning = true;
orbitControls.panSpeed = 0.5;
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
orbitControls.minPolarAngle = Math.PI / 4;
orbitControls.rotateSpeed = 0.8;

// LIGHTS
const dLight = new THREE.DirectionalLight('white', 1);
dLight.position.set(20, 30, 0);
dLight.castShadow = true;
dLight.shadow.mapSize.set(4096, 4096);
const d = 35;
dLight.shadow.camera.left = -d;
dLight.shadow.camera.right = d;
dLight.shadow.camera.top = d;
dLight.shadow.camera.bottom = -d;
scene.add(dLight);

const aLight = new THREE.AmbientLight('white', 0.3);
scene.add(aLight);

// AGENT
const agentHeight = 2.5;
const agentRadius = 0.45;
const agentGroup = new THREE.Group();
scene.add(agentGroup);
agentGroup.visible = false; // Initially hide the agent

// Load custom agent model
const gltfLoader = new GLTFLoader();
gltfLoader.load('./glb/map_pointer.glb', (gltf: GLTF) => {
    const model = gltf.scene;
    
    // Adjust the model's scale if needed
    model.scale.set(0.5, 0.5, 0.5); // Adjust these values as needed
    
    // Center the model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    
    // Adjust the model's vertical position
    model.position.y = agentHeight / 2;
    
    agentGroup.add(model);
}, undefined, (error) => {
    console.error('An error occurred while loading the GLB model:', error);
});

// POSITION INDICATOR
const positionIndicatorGeometry = new THREE.SphereGeometry(0.5, 16, 16);
const positionIndicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
const positionIndicator = new THREE.Mesh(positionIndicatorGeometry, positionIndicatorMaterial);
scene.add(positionIndicator);

// Get elements
const currentLocationDropdown = document.getElementById('current-location') as HTMLSelectElement;
const destinationDropdown = document.getElementById('destination') as HTMLSelectElement;
const startButton = document.getElementById('start-button') as HTMLButtonElement;
const resetButton = document.getElementById('reset-button') as HTMLButtonElement;
const levelSelect = document.getElementById('level-select') as HTMLSelectElement;
const toggleVoiceNavButton = document.getElementById('toggle-voice-nav') as HTMLButtonElement;
const addMarkerButton = document.getElementById('add-marker-button') as HTMLButtonElement;
const markerNameInput = document.getElementById('marker-name-input') as HTMLInputElement;

// VARIABLES
let currentLocation = new THREE.Vector3();
let destination = new THREE.Vector3();
let navpath: THREE.Vector3[] = [];
let startMoving = false;
let followAgent = false;
const cameraOffset = new THREE.Vector3(0, 20, 25);
const cameraLookAhead = new THREE.Vector3(0, 2, 10);

// PATHFINDING SETUP
const pathfinding = new Pathfinding();
const pathfindingHelper = new PathfindingHelper();
scene.add(pathfindingHelper);

const SPEED = 2;
let groupID: string | undefined;

// New variables for steps and levels
let steps: string[] = [];
let currentStepIndex = 0;
let currentLevel = 1;
const levels = [
    { 
        id: 1, 
        name: 'Ground Floor', 
        file: './glb/UG.glb', 
        navMeshFile: './glb/level1-navmesh.glb',
        connections: [
            { to: 2, position: new THREE.Vector3(0, 0, -10), name: 'Escalator to 1st Floor' }
        ],
        object: null as THREE.Object3D | null,
        navMesh: null as THREE.Mesh | null
    },
    { 
        id: 2, 
        name: '1st Floor', 
        file: './assets/glb/LG.glb', 
        navMeshFile: './assets/glb/level2-navmesh.glb',
        connections: [
            { to: 1, position: new THREE.Vector3(0, 0, -10), name: 'Escalator to Ground Floor' }
        ],
        object: null as THREE.Object3D | null,
        navMesh: null as THREE.Mesh | null
    },
];

// Voice navigation variables
let voiceNavEnabled = false;
let speechSynthesis: SpeechSynthesis;
let voices: SpeechSynthesisVoice[];
let currentUtterance: SpeechSynthesisUtterance | null = null;

// Custom marker variables
let isAddingMarker = false;
const customMarkers: { position: THREE.Vector3, name: string }[] = [];

// Initialize speech synthesis
if ('speechSynthesis' in window) {
    speechSynthesis = window.speechSynthesis;
    speechSynthesis.onvoiceschanged = () => {
        voices = speechSynthesis.getVoices();
    };
} else {
    console.error('Speech synthesis not supported');
}

// Function to speak a message
function speak(message: string) {
    if (voiceNavEnabled && speechSynthesis) {
        if (currentUtterance) {
            speechSynthesis.cancel();
        }
        currentUtterance = new SpeechSynthesisUtterance(message);
        
        // Increase speech rate (1.0 is normal, 2.0 is twice as fast)
        currentUtterance.rate = 1.5;
        
        // Try to find an Indian English female voice
        let selectedVoice = voices.find(voice => 
            voice.name.toLowerCase().includes('female') && 
            voice.lang.startsWith('en-IN')
        );
        
        // If no Indian English female voice is found, fall back to any English female voice
        if (!selectedVoice) {
            selectedVoice = voices.find(voice => 
                voice.name.toLowerCase().includes('female') && 
                voice.lang.startsWith('en')
            );
        }
        
        // If still no female voice is found, use any available voice
        currentUtterance.voice = selectedVoice || null;
        
        // Adjust pitch to sound more feminine if a male voice is selected
        if (currentUtterance.voice && !currentUtterance.voice.name.toLowerCase().includes('female')) {
            currentUtterance.pitch = 1.5; // Slightly higher pitch
        }
        
        speechSynthesis.speak(currentUtterance);
    }
}

// LOAD LEVEL AND NAVMESH
const loader = new GLTFLoader();

function loadLevel(levelId: number) {
    const level = levels.find(l => l.id === levelId);
    if (!level) return;

    // Hide all levels
    levels.forEach(l => {
        if (l.object) l.object.visible = false;
        if (l.navMesh) l.navMesh.visible = false;
    });

    // If the level is already loaded, just make it visible
    if (level.object && level.navMesh) {
        level.object.visible = true;
        level.navMesh.visible = true;
    } else {
        // Load new level geometry
        loader.load(level.file, (gltf: GLTF) => {
            level.object = gltf.scene;
            scene.add(level.object);
        });

        // Load new navmesh
        loader.load(level.navMeshFile, (gltf: GLTF) => {
            gltf.scene.traverse((node) => {
                if ((node as THREE.Mesh).isMesh) {
                    level.navMesh = node as THREE.Mesh;
                    pathfinding.setZoneData(`level${levelId}`, Pathfinding.createZone(level.navMesh.geometry));
                }
            });
        });
    }

    // Reset pathfinding and agent position
    navpath = [];
    agentGroup.position.set(0, 0, 0);
    agentGroup.visible = false;
    updatePositionIndicator();
}

// Initial level load (Ground Floor)
loadLevel(1);

// UPDATE POSITION INDICATOR
function updatePositionIndicator() {
    positionIndicator.position.copy(agentGroup.position);
}

// GENERATE STEPS
function generateSteps(path: THREE.Vector3[]) {
    steps = [];
    let prevDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(agentGroup.quaternion);

    for (let i = 1; i < path.length; i++) {
        const prevPoint = path[i - 1];
        const currentPoint = path[i];
        const direction = new THREE.Vector3().subVectors(currentPoint, prevPoint).normalize();
        const distance = prevPoint.distanceTo(currentPoint);
        
        const angle = prevDirection.angleTo(direction);
        const cross = new THREE.Vector3().crossVectors(prevDirection, direction);
        
        let stepDirection: string;
        if (angle < Math.PI / 8) {
            stepDirection = "Go straight";
        } else if (angle > 8 * Math.PI / 8) {
            stepDirection = "Turn around";
        } else if (cross.y > 0) {
            stepDirection = "Turn left";
        } else {
            stepDirection = "Turn right";
        }
        
        const step = `${stepDirection} for ${distance.toFixed(2)} meters`;
        steps.push(step);
        prevDirection = direction;
    }
    updateStepsDisplay();
}

// UPDATE STEPS DISPLAY
function updateStepsDisplay() {
    const stepsContainer = document.getElementById('steps-container');
    if (stepsContainer) {
        stepsContainer.innerHTML = '';
        steps.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.textContent = `${index + 1}. ${step}`;
            stepElement.className = index === currentStepIndex ? 'current-step' : '';
            stepsContainer.appendChild(stepElement);
        });
    }
}

// CALCULATE PATH
function calculatePath() {
    const destinationCoords = destinationDropdown.options[destinationDropdown.selectedIndex].getAttribute('data-coords')?.split(',').map(Number);

    if (currentLocation && destinationCoords) {
        destination.set(destinationCoords[0], destinationCoords[1], destinationCoords[2]);

        // Find path to the destination
        groupID = pathfinding.getGroup(`level${currentLevel}`, currentLocation);
        const closestStart = pathfinding.getClosestNode(currentLocation, `level${currentLevel}`, groupID);
        const closestEnd = pathfinding.getClosestNode(destination, `level${currentLevel}`, groupID);
        navpath = pathfinding.findPath(closestStart.centroid, closestEnd.centroid, `level${currentLevel}`, groupID) || [];

        updatePathfinding();
        generateSteps(navpath);
        updateStepsDisplay();
    } else {
        console.error('Invalid current location or destination');
    }
}

// START NAVIGATION
function startNavigation() {
    if (navpath.length > 0) {
        startMoving = true;
        followAgent = true;
        orbitControls.enabled = false;
        currentStepIndex = 0;

        const initialDirection = new THREE.Vector3().subVectors(navpath[0], agentGroup.position).normalize();
        agentGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), initialDirection);
        updateCameraPosition();
        
        if (voiceNavEnabled) {
            speak('Starting navigation. ' + steps[0]);
        }

        updateStepsDisplay();
    } else {
        console.error('No path calculated. Please select a destination first.');
    }
}

// RESET
function reset() {
    currentLocationDropdown.selectedIndex = 0;
    destinationDropdown.selectedIndex = 0;
    navpath = [];
    positionIndicator.position.set(0, 0, 0);
    agentGroup.position.set(0, 0, 0);
    agentGroup.visible = false;
    startMoving = false;
    followAgent = false;
    orbitControls.enabled = true;
    pathfindingHelper.reset();
    pathfindingHelper.setPath([]);
    camera.position.set(33, 10, 10);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    steps = [];
    currentStepIndex = 0;
    updateStepsDisplay();
    if (voiceNavEnabled) {
        speak('Navigation reset');
    }
}

// PATHFINDING UPDATE
function updatePathfinding() {
    if (navpath.length <= 0) return;

    pathfindingHelper.reset();
    pathfindingHelper.setPlayerPosition(agentGroup.position);
    pathfindingHelper.setTargetPosition(destination);
    pathfindingHelper.setPath(navpath);
}

// MOVEMENT ALONG PATH
const REACH_THRESHOLD = 0.1;

function move(delta: number) {
    if (!startMoving || navpath.length <= 0) return;

    const targetPosition = navpath[0];
    const distance = targetPosition.clone().sub(agentGroup.position);
    const length = distance.length();

    if (length > REACH_THRESHOLD) {
        const moveDistance = delta * SPEED;
        const moveVector = distance.clone().normalize().multiplyScalar(moveDistance);

        // Update agent's rotation
        const lookAtMatrix = new THREE.Matrix4().lookAt(agentGroup.position, targetPosition, new THREE.Vector3(0, 1, 0));
        const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(lookAtMatrix);
        agentGroup.quaternion.slerp(targetQuaternion, 0.1);

        // Smooth movement
        agentGroup.position.add(moveVector);

        // Ensure the position does not overshoot
        if (distance.length() < moveDistance) {
            agentGroup.position.copy(targetPosition);
        }

        // Update camera position
        updateCameraPosition();
    } else {
        navpath.shift();
        currentStepIndex++;
        updateStepsDisplay();
        if (voiceNavEnabled && steps[currentStepIndex]) {
            speak(steps[currentStepIndex]);
        }
    }

    if (navpath.length === 0) {
        startMoving = false;
        followAgent = false;
        orbitControls.enabled = true;
        if (voiceNavEnabled) {
            speak("You have reached your destination");
        }
        showDestinationPopup();
    }
}

// UPDATE CAMERA POSITION
function updateCameraPosition() {
    if (followAgent) {
        const currentPosition = agentGroup.position;
        const targetPosition = navpath.length > 0 ? navpath[0]! : destination;

        // Calculate the direction of movement
        const direction = new THREE.Vector3().subVectors(targetPosition, currentPosition).normalize();

        // Calculate the desired camera position (behind and slightly above the agent)
        const desiredCameraPosition = new THREE.Vector3().addVectors(
            currentPosition,
            direction.clone().multiplyScalar(-cameraOffset.z).add(new THREE.Vector3(0, cameraOffset.y, 0))
        );

        // Smoothly interpolate the camera position
        camera.position.lerp(desiredCameraPosition, 0.05);

        // Calculate the look-at point (ahead and slightly above the agent)
        const lookAtPoint = new THREE.Vector3().addVectors(
            currentPosition,
            direction.clone().multiplyScalar(cameraLookAhead.z).add(new THREE.Vector3(0, cameraLookAhead.y, 0))
        );

        // Smoothly interpolate the camera's look-at point
        const currentLookAt = new THREE.Vector3();
        camera.getWorldDirection(currentLookAt);
        const targetLookAt = new THREE.Vector3().subVectors(lookAtPoint, camera.position).normalize();
        const interpolatedLookAt = new THREE.Vector3().lerpVectors(currentLookAt, targetLookAt, 0.05);
        camera.lookAt(camera.position.clone().add(interpolatedLookAt));
    }
}

// Function to add a custom marker
function addCustomMarker(position: THREE.Vector3, name: string) {
    const markerGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
    markerMesh.position.copy(position);
    scene.add(markerMesh);

    customMarkers.push({ position, name });

    // Add the new marker to both dropdowns
    const option = document.createElement('option');
    option.value = `custom-${customMarkers.length - 1}`;
    option.textContent = name;
    option.setAttribute('data-coords', `${position.x},${position.y},${position.z}`);

    currentLocationDropdown.appendChild(option.cloneNode(true));
    destinationDropdown.appendChild(option.cloneNode(true));

    // Update the navmesh to include the new marker
    updateNavMeshWithCustomMarker(position);
}

// Function to update the navmesh with a new custom marker
function updateNavMeshWithCustomMarker(position: THREE.Vector3) {
    const level = levels.find(l => l.id === currentLevel);
    if (!level || !level.navMesh) return;

    // Create a new vertex for the custom marker
    const newVertex = new THREE.Vector3().copy(position);

    // Get the existing geometry
    const geometry = level.navMesh.geometry;

    // Add the new vertex to the geometry
    const vertices = geometry.attributes.position.array as Float32Array;
    const newVertices = new Float32Array(vertices.length + 3);
    newVertices.set(vertices);
    newVertices.set([newVertex.x, newVertex.y, newVertex.z], vertices.length);

    // Update the geometry with the new vertices
    geometry.setAttribute('position', new THREE.BufferAttribute(newVertices, 3));

    // Update the Pathfinding zone data
    pathfinding.setZoneData(`level${currentLevel}`, Pathfinding.createZone(geometry));
}

// Function to handle QR code data and update user location
function updateUserLocation(scannedData: { name: string, coords: string }) {
    const [x, y, z] = scannedData.coords.split(',').map(Number);
    currentLocation.set(x, y, z);
    agentGroup.position.copy(currentLocation);
    agentGroup.visible = true;
    updatePositionIndicator();

    // Update the current location dropdown
    const options = Array.from(currentLocationDropdown.options);
    const matchingOption = options.find(option => option.textContent === scannedData.name);
    if (matchingOption) {
        currentLocationDropdown.value = matchingOption.value;
        // Trigger a change event to update any listeners
        const event = new Event('change');
        currentLocationDropdown.dispatchEvent(event);
    }

    // If voice navigation is enabled, announce the new location
    if (voiceNavEnabled) {
        speak(`You are now at ${scannedData.name}`);
    }

    // If a destination is set, recalculate the path
    if (destination.length() > 0) {
        calculatePath();
    }
}

// Function to parse URL parameters
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const locationParam = params.get('location');
    if (locationParam) {
        try {
            return JSON.parse(decodeURIComponent(locationParam));
        } catch (error) {
            console.error('Error parsing location data:', error);
        }
    }
    return null;
}

// Initialize the scene and update user location based on URL parameters
function initializeScene() {
    const locationData = getUrlParams();
    if (locationData) {
        updateUserLocation(locationData);
    }

    // ... (rest of the initialization code)
}

// EVENT LISTENERS
currentLocationDropdown.addEventListener('change', () => {
    const coords = currentLocationDropdown.options[currentLocationDropdown.selectedIndex].getAttribute('data-coords')?.split(',').map(Number);
    if (coords) {
        currentLocation.set(coords[0], coords[1], coords[2]);
        agentGroup.position.copy(currentLocation);
        agentGroup.visible = true;
        updatePositionIndicator();

        // If a destination is set, recalculate the path
        if (destination.length() > 0) {
            calculatePath();
        }
    }
});

destinationDropdown.addEventListener('change', () => {
    const coords = destinationDropdown.options[destinationDropdown.selectedIndex].getAttribute('data-coords')?.split(',').map(Number);
    if (coords) {
        destination.set(coords[0], coords[1], coords[2]);
        calculatePath();
    }
});

startButton.addEventListener('click', startNavigation);

resetButton.addEventListener('click', reset);

levelSelect.addEventListener('change', (event) => {
    const newLevel = parseInt((event.target as HTMLSelectElement).value);
    if (newLevel !== currentLevel) {
        currentLevel = newLevel;
        loadLevel(currentLevel);
        reset();
    }
});

// Updated toggleVoiceNavigation function
function toggleVoiceNavigation() {
    voiceNavEnabled = !voiceNavEnabled;
    if (voiceNavEnabled) {
        toggleVoiceNavButton.style.backgroundColor = 'var(--secondary)';
        speak('Voice navigation enabled');
    } else {
        toggleVoiceNavButton.style.backgroundColor = 'var(--primary)';
        if (currentUtterance) {
            speechSynthesis.cancel();
        }
        speak('Voice navigation disabled');
    }
    console.log('Voice navigation toggled:', voiceNavEnabled);
}

// Update the event listener for the toggle voice nav button
toggleVoiceNavButton.addEventListener('click', toggleVoiceNavigation);

// Add marker button event listener
addMarkerButton.addEventListener('click', () => {
    isAddingMarker = !isAddingMarker;
    addMarkerButton.textContent = isAddingMarker ? 'Cancel' : 'Add Marker';
    markerNameInput.style.display = isAddingMarker ? 'block' : 'none';
    orbitControls.enabled = !isAddingMarker;
});

// Map container click event for adding markers
mapContainer.addEventListener('click', (event) => {
    if (!isAddingMarker) return;

    const rect = mapContainer.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / mapContainer.clientWidth) * 2 - 1;
    const y = -((event.clientY - rect.top) / mapContainer.clientHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point;
        const markerName = markerNameInput.value.trim() || `Marker ${customMarkers.length + 1}`;
        addCustomMarker(intersectionPoint, markerName);

        // Reset marker adding state
        isAddingMarker = false;
        addMarkerButton.textContent = 'Add Marker';
        markerNameInput.style.display = 'none';
        markerNameInput.value = '';
        orbitControls.enabled = true;
    }
});

// Add new event listeners for the popup
const destinationPopup = document.getElementById('destination-popup') as HTMLDivElement;
const overlay = document.getElementById('overlay') as HTMLDivElement;
const closePopupButton = document.getElementById('close-popup') as HTMLButtonElement;

function showDestinationPopup() {
    destinationPopup.style.display = 'block';
    overlay.style.display = 'block';
}

function hideDestinationPopup() {
    destinationPopup.style.display = 'none';
    overlay.style.display = 'none';
    reset();
}

closePopupButton.addEventListener('click', hideDestinationPopup);

// Call initializeScene when the document is loaded
document.addEventListener('DOMContentLoaded', initializeScene);

// ANIMATE
function animate() {
    requestAnimationFrame(animate);
    const delta = 0.016; // Assuming 60fps for smoother animation
    if (!followAgent) {
        orbitControls.update();
    }
    move(delta);
    updatePositionIndicator();
    renderer.render(scene, camera);
}

animate();

// RESIZE
window.addEventListener('resize', () => {
    camera.aspect = mapContainer.clientWidth / mapContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(mapContainer.clientWidth, mapContainer.clientHeight);
});

// Initial resize to ensure correct aspect ratio
window.dispatchEvent(new Event('resize'));

// Add event listener for messages from qr-gen.html
window.addEventListener('message', function(event) {
    if (event.data.type === 'updateLocation') {
        updateUserLocation(event.data.data);
    }
});