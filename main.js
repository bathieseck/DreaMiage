window.addEventListener('DOMContentLoaded', function () {
    const playButton = document.getElementById('playButton');
    playButton.addEventListener('click', () => {
        document.getElementById('startScreen').style.display = 'none';
        launchGame();
    });
});

function launchGame() {
    const loader = document.getElementById('loader');
    loader.classList.add('visible');

    const canvas = document.getElementById('renderCanvas');
    const engine = new BABYLON.Engine(canvas, true);
    let bonhomme;
    const createScene = function () {
        let mainAnim = null;
        let wasMoving = false;
        let lastBonhommePos = null;

        const scene = new BABYLON.Scene(engine);
        addSceneOptions(scene);
        addDecorations(scene);
        const solidObjects = [];
        const platformPositions = [];
        let isFreeCamMode = false;
        let checkpointPosition = new BABYLON.Vector3(0, 5, 0);
        let checkpointReached = false;



        // Génération des 10 plateformes avec un effet tordu horizontalement
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const offsetX = Math.sin(i * 0.5) * 30;  // plus éloigné
            const offsetZ = Math.cos(i * 0.5) * 30;  // plus éloigné
            const height = 5 + i * 5;
            platformPositions.push(new BABYLON.Vector3(offsetX, height, offsetZ));
        }

        platformPositions.forEach((pos, i) => {
            const plat = BABYLON.MeshBuilder.CreateCylinder(`platform${i}`, {
                diameter: 12,
                height: 0.7
            }, scene);
            plat.rotation.x = 0;
            plat.position = new BABYLON.Vector3(pos.x, pos.y - 0.5, pos.z);
            plat.checkCollisions = true;

            // Nouveau matériau avec texture
            const mat = new BABYLON.StandardMaterial(`platMat${i}`, scene);

            // Utilisation d'une texture de gravier en ligne
            const texture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/ground.jpg", scene);
            texture.uScale = 3; // répétition horizontale
            texture.vScale = 3; // répétition verticale

            mat.diffuseTexture = texture;
            plat.material = mat;

            solidObjects.push(plat);
            createObject(solidObjects, plat, i, scene);
        });

        if (platformPositions.length >= 2) {
            const lastPlatformPos = platformPositions[platformPositions.length - 1];
            const beforeLastPlatformPos = platformPositions[platformPositions.length - 2];
            const rectangleList = [];
            const rectangleDirection = lastPlatformPos.subtract(beforeLastPlatformPos).normalize();

            addRectangles(lastPlatformPos, rectangleDirection, scene, rectangleList, solidObjects, engine);

            const lastRect = rectangleList[rectangleList.length - 1];
            const DiskDirection = lastPlatformPos.subtract(beforeLastPlatformPos).normalize(); 
            const diskDistance = 20; 

            const diskPos = lastRect.position.add(DiskDirection.scale(diskDistance));

            const disk = BABYLON.MeshBuilder.CreateCylinder("finalDisk", {
                diameter: 14,  
                height: 1.2,   
                tessellation: 64
            }, scene);
            disk.position = new BABYLON.Vector3(diskPos.x, lastRect.position.y - 0.5, diskPos.z); 
            disk.checkCollisions = true;

            const diskMat = new BABYLON.StandardMaterial("diskMat", scene);
            diskMat.diffuseColor = new BABYLON.Color3(0.3, 1, 0.4);
            disk.material = diskMat;

            const baseY = disk.position.y;
            let diskTime = 0;
            const amplitude = 100;

            scene.onBeforeRenderObservable.add(() => {
                diskTime += engine.getDeltaTime();
                const speed = 0.001;        
                disk.position.y = baseY + (Math.sin(diskTime * speed) * 0.5 + 0.5) * amplitude;
            });
            solidObjects.push(disk);

            // Plateforme finale alignée, plus loin et plus haut que le disk
            const horizontalOffset = 15; // distance en avant du disk
            const verticalOffset = 2 ;   // plus haut que la position max du disk (il faut sauter)

            const finalPlatformPos = disk.position.add(rectangleDirection.scale(horizontalOffset));
            finalPlatformPos.y = baseY + amplitude + verticalOffset; // au-dessus de la hauteur max du disk

            const horizontalPlatform = BABYLON.MeshBuilder.CreateBox("horizontalPlatform", {
                width: 80,
                height: 1.2,
                depth: 4
            }, scene);

            horizontalPlatform.position = finalPlatformPos;
            const directionAngle = horizontalPlatform.rotation.y;
            const forward = new BABYLON.Vector3(Math.sin(directionAngle), 0, Math.cos(directionAngle)).normalize();
            const right = BABYLON.Vector3.Cross(BABYLON.Axis.Y, forward).normalize();

            horizontalPlatform.position.addInPlace(forward.scale(25));  // vers l'avant
            horizontalPlatform.position.addInPlace(right.scale(6));   // vers la gauche (négatif)

            horizontalPlatform.rotation.y = Math.PI / 2;

            // Matériau
            const platformMat = new BABYLON.StandardMaterial("platformMat", scene);
            platformMat.diffuseColor = new BABYLON.Color3(1, 0.6, 0.2); // orange
            horizontalPlatform.material = platformMat;

            horizontalPlatform.checkCollisions = true;
            solidObjects.push(horizontalPlatform);

            // === Obstacles latéraux traversants à éviter ===
            const nbObstacles = 6;
            const spacing = 5; // écart vertical entre chaque obstacle
            const obstacleDepth = 1;
            const obstacleHeight = 6;
            const obstacleWidth = 1;
            const platformWidth = 40; // même que horizontalPlatform.width
            const movementDistance = platformWidth; // ils traversent toute la plateforme
            const moveSpeed = 0.002;

            for (let i = 0; i < nbObstacles; i++) {
                const isFromRight = i % 2 === 0;
                const side = isFromRight ? 1 : -1;
                const baseX = horizontalPlatform.position.x + (side * platformWidth / 2);
                const baseY = horizontalPlatform.position.y + obstacleHeight / 2;
                const baseZ = horizontalPlatform.position.z + (i - nbObstacles / 2) * spacing;
            
                const obstacle = BABYLON.MeshBuilder.CreateBox(`obstacleSweeper${i}`, { // ← nom commence par "obstacle"
                    width: obstacleWidth,
                    height: obstacleHeight,
                    depth: obstacleDepth
                }, scene);
            
                obstacle.position = new BABYLON.Vector3(baseX, baseY, baseZ);
                obstacle.checkCollisions = true;
            
                const mat = new BABYLON.StandardMaterial(`sweepObstacleMat${i}`, scene);
                mat.diffuseColor = new BABYLON.Color3(1, 0, 0);
                obstacle.material = mat;
            
                let time = 0;
                const direction = -side;
            
                scene.onBeforeRenderObservable.add(() => {
                    time += engine.getDeltaTime();
                    const t = Math.sin(time * moveSpeed);
                    obstacle.position.x = baseX + direction * (t + 1) / 2 * movementDistance;
                    obstacle.refreshBoundingInfo();
                });
            
                solidObjects.push(obstacle);
            }

            // === ÎLE FINALE SOLIDE ALIGNÉE AVEC LA PLATEFORME ===
            const islandDistance = 0; // distance en avant
            const islandOffsetY = -2;  // légère baisse

            const horizontalForward = new BABYLON.Vector3(Math.sin(horizontalPlatform.rotation.y),0,Math.cos(horizontalPlatform.rotation.y)).normalize();
            // Direction latérale (vers la droite)
            const horizontalRight = BABYLON.Vector3.Cross(BABYLON.Axis.Y, horizontalForward).normalize();


            const islandPos = horizontalPlatform.position
            .add(horizontalForward.scale(islandDistance))
            .add(horizontalRight.scale(-80));
            islandPos.y += islandOffsetY;

            const finalIsland = BABYLON.MeshBuilder.CreateCylinder("finalIsland", {
                diameter: 60,
                height: 1.5,
                tessellation: 64
            }, scene);
            finalIsland.position = islandPos;
            finalIsland.checkCollisions = true;

            const islandMat = new BABYLON.StandardMaterial("islandMat", scene);
            const islandTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/grass.png", scene);
            islandTexture.uScale = 4;
            islandTexture.vScale = 4;
            islandMat.diffuseTexture = islandTexture;
            finalIsland.material = islandMat;

            solidObjects.push(finalIsland);


            


        }

        // Création d'un proxy invisible pour ton personnage
        bonhomme = new BABYLON.Mesh("bonhommeProxy", scene);
        bonhomme.isVisible = false;
        bonhomme.checkCollisions = true;
        bonhomme.ellipsoid = new BABYLON.Vector3(1, 2, 1);
        bonhomme.ellipsoidOffset = new BABYLON.Vector3(0, 2, 0);

        const savedPos = localStorage.getItem("bonhomme_position");
        if (savedPos) {
            const pos = JSON.parse(savedPos);
            bonhomme.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
        } else {
            bonhomme.position = new BABYLON.Vector3(0, 5, 0);
        }

        BABYLON.SceneLoader.ImportMesh(
            null,
            "models/",
            "walking_astronaut.glb",
            scene,
            function (meshes, particleSystems, skeletons, animationGroups) {
                if (!meshes || meshes.length === 0) {
                    console.error("Erreur : modèle non chargé.");
                    return;
                }
        
                // Créer un container pour gérer l'ensemble
                const modelContainer = new BABYLON.TransformNode("astronautContainer", scene);
                modelContainer.parent = bonhomme; // attaché au proxy
                modelContainer.position = new BABYLON.Vector3(0, -1, 0); // ← à ajuster selon la taille réelle du modèle
        
                // On scale ici (ex : divisé par 10)
                modelContainer.scaling = new BABYLON.Vector3(0.02, 0.02, 0.02); // ajuste selon le modèle
        
                // Re-parent tous les sous-meshes
                meshes.forEach(mesh => {
                    mesh.parent = modelContainer;
                });
        
                // Animation s'il y en a
                if (animationGroups && animationGroups.length > 0) {
                    mainAnim = animationGroups[0];
                    // On ne démarre pas tout de suite
                    mainAnim.stop(); 
                }
                
            }
        );

        
        


        //SPAWN DU BONHOMME A CHANGER
        // bonhomme.position = new BABYLON.Vector3(platformPositions[platformPositions.length - 1].x, platformPositions[platformPositions.length - 1].y, platformPositions[platformPositions.length - 1].z);

        // Faire apparaître le bonhomme sur la plateforme finale
        const horizontalPlatformMesh = scene.getMeshByName("horizontalPlatform");
        if (horizontalPlatformMesh) {
            // Clone la position de base
            bonhomme.position = horizontalPlatformMesh.position.clone();
            bonhomme.position.y += 1;

            // Décale le bonhomme vers le bord gauche (vers le disk)
            const backward = new BABYLON.Vector3(Math.cos(horizontalPlatformMesh.rotation.y), 0, -Math.sin(horizontalPlatformMesh.rotation.y));
            bonhomme.position.addInPlace(backward.scale(horizontalPlatformMesh.scaling.x * 15)); // bord
        }
        else {
            // Position par défaut si la plateforme n'existe pas
            bonhomme.position = new BABYLON.Vector3(0, 5, 0);
        }

        bonhomme.checkCollisions = true;
        const camera = new BABYLON.ArcRotateCamera("arcCam", Math.PI / 2, Math.PI / 2.5, 20, new BABYLON.Vector3(0, 1, 0), scene);
        camera.attachControl(canvas, true);
        // Caméra par défaut : centrée sur le bonhomme
        const arcCamera = camera;
        arcCamera.attachControl(canvas, true);

        const freeCamera = new BABYLON.FreeCamera("freeCam", bonhomme.position.add(new BABYLON.Vector3(0, 10, -10)), scene);
        freeCamera.setTarget(bonhomme.position);
        freeCamera.attachControl(canvas, false);
        freeCamera.speed = 0.5;

        let activeCamera = arcCamera;
        scene.activeCamera = arcCamera;

        window.addEventListener("keydown", (e) => {
            if (e.key.toLowerCase() === "v") {
                if (activeCamera === arcCamera) {
                    arcCamera.detachControl(canvas);
                    scene.activeCamera = freeCamera;
                    freeCamera.attachControl(canvas, true);
                    activeCamera = freeCamera;
                    isFreeCamMode = true;
                } else {
                    freeCamera.detachControl(canvas);
                    scene.activeCamera = arcCamera;
                    arcCamera.attachControl(canvas, true);
                    activeCamera = arcCamera;
                    isFreeCamMode = false;
                }
            }
        });

        let mouseSensitivity = 0.002;
        let verticalSensitivity = 0.002;
        let alpha = camera.alpha;
        let beta = camera.beta;

        let targetAlpha = camera.alpha;
        let targetBeta = camera.beta;

        canvas.addEventListener("mousemove", (e) => {
            if (!document.pointerLockElement) return;
            targetAlpha -= e.movementX * mouseSensitivity;
            targetBeta -= e.movementY * verticalSensitivity;
            targetBeta = BABYLON.Scalar.Clamp(targetBeta, 0.2, Math.PI / 2.2);
        });

        canvas.addEventListener("click", () => {
            canvas.requestPointerLock();
        });

        const inputMap = {};
        scene.actionManager = new BABYLON.ActionManager(scene);
        scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, evt => {
            const key = evt.sourceEvent.key.toLowerCase();
            inputMap[key] = true;

            if (key === "r") {
                bonhomme.position = new BABYLON.Vector3(0, 5, 0);
                localStorage.removeItem("bonhomme_position");
            }
        }));
        scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, evt => {
            inputMap[evt.sourceEvent.key.toLowerCase()] = false;
        }));

        let velocityY = 0;
        let isJumping = false;

        scene.onBeforeRenderObservable.add(() => {
            if (!bonhomme) return;
            
            const currentPos = bonhomme.position.clone();
            const isMoving = lastBonhommePos && !bonhomme.position.equalsWithEpsilon(lastBonhommePos, 0.01);

            if (mainAnim) {
                if (isMoving && !mainAnim.isPlaying) {
                    mainAnim.start(true);
                    mainAnim.speedRatio = 10.5;
                } else if (!isMoving && mainAnim.isPlaying) {
                    mainAnim.stop();
                }
            }
            lastBonhommePos = currentPos;


            localStorage.setItem("bonhomme_position", JSON.stringify({
                x: bonhomme.position.x,
                y: bonhomme.position.y,
                z: bonhomme.position.z
            }));

            if (!isFreeCamMode) {
                // mouvement du bonhomme (inchangé)
                let baseSpeed = 0.12;
                let sprintSpeed = 0.36;
                let speed = inputMap["shift"] ? sprintSpeed : baseSpeed;

                let input = new BABYLON.Vector3.Zero();
                const isMoving = !input.equals(BABYLON.Vector3.Zero());

                if (mainAnim) {
                    if (isMoving && !wasMoving) {
                        mainAnim.start(true); // relancer en boucle
                    } else if (!isMoving && wasMoving) {
                        mainAnim.stop();
                    }
                }
                wasMoving = isMoving;

                if (inputMap["z"] || inputMap["arrowup"]) input.z += 1;
                if (inputMap["s"] || inputMap["arrowdown"]) input.z -= 1;
                if (inputMap["d"] || inputMap["arrowright"]) input.x -= 1;
                if (inputMap["q"] || inputMap["arrowleft"]) input.x += 1;

                if (!input.equals(BABYLON.Vector3.Zero())) {
                    input = input.normalize();
                    const forward = camera.getForwardRay().direction;
                    const right = BABYLON.Vector3.Cross(forward, BABYLON.Axis.Y).normalize();
                    const moveDirection = new BABYLON.Vector3.Zero();
                    moveDirection.addInPlace(forward.scale(input.z));
                    moveDirection.addInPlace(right.scale(input.x));
                    moveDirection.y = 0;
                    moveDirection.normalize();

                    bonhomme.moveWithCollisions(moveDirection.scale(speed));
                    bonhomme.rotation.y = Math.atan2(moveDirection.x, moveDirection.z);
                } else {
                    const cameraDirection = camera.getForwardRay().direction.clone();
                    cameraDirection.y = 0;
                    cameraDirection.normalize();
                    bonhomme.rotation.y = Math.atan2(cameraDirection.x, cameraDirection.z);
                }
            } else {
                let move = new BABYLON.Vector3.Zero();
                if (inputMap["z"] || inputMap["arrowup"]) {
                    move.addInPlace(freeCamera.getDirection(BABYLON.Axis.Z));
                }
                if (inputMap["s"] || inputMap["arrowdown"]) {
                    move.addInPlace(freeCamera.getDirection(BABYLON.Axis.Z).scale(-1));
                }
                if (inputMap["d"] || inputMap["arrowright"]) {
                    move.addInPlace(freeCamera.getDirection(BABYLON.Axis.X));
                }
                if (inputMap["q"] || inputMap["arrowleft"]) {
                    move.addInPlace(freeCamera.getDirection(BABYLON.Axis.X).scale(-1));
                }
                if (inputMap[" "]) {
                    move.addInPlace(BABYLON.Axis.Y);
                }
                if (inputMap["shift"]) {
                    move.addInPlace(BABYLON.Axis.Y.scale(-1));
                }

                move.normalize();
                freeCamera.cameraDirection = move.scale(0.5);

            }

            // Gestion des collisions au sol et sur plateformes
            let onSomething = false;
            const platformRadius = 30;

            if (bonhomme.position.y <= 1 && Math.sqrt(bonhomme.position.x ** 2 + bonhomme.position.z ** 2) <= platformRadius) {
                bonhomme.position.y = 1;
                velocityY = 0;
                isJumping = false;
                onSomething = true;
            }

            solidObjects.forEach(plat => {
                const boundingBox = plat.getBoundingInfo().boundingBox;
            
                const min = boundingBox.minimumWorld;
                const max = boundingBox.maximumWorld;
            
                const isWithinX = bonhomme.position.x >= min.x && bonhomme.position.x <= max.x;
                const isWithinZ = bonhomme.position.z >= min.z && bonhomme.position.z <= max.z;
                const isAbove = bonhomme.position.y > max.y - 0.2; // un peu au-dessus
                const isFalling = velocityY <= 0;
            
                if (isWithinX && isWithinZ && isAbove && isFalling) {
                    const diffY = bonhomme.position.y - max.y;
                    if (diffY <= 1.1) {
                        bonhomme.position.y = max.y + 1;
                        velocityY = 0;
                        isJumping = false;
                        onSomething = true;
                    }
                }
            });
            

            if (onSomething && !isJumping && inputMap[" "]) {
                velocityY = 0.25;
                isJumping = true;
            }

            velocityY -= 0.005;
            bonhomme.position.y += velocityY;

            if (bonhomme.position.y < -100) {
                const currentAlpha = camera.alpha;
                const currentBeta = camera.beta;
            
                bonhomme.position = checkpointPosition.clone();
                velocityY = 0;
                isJumping = false;
            
                camera.alpha = currentAlpha;
                camera.beta = currentBeta;
            }
            

            solidObjects.forEach(obj => {
                if (!obj.name.startsWith("obstacle")) return;
            
                const obstacleBox = obj.getBoundingInfo().boundingBox;
                const bonhommeBox = bonhomme.getBoundingInfo().boundingBox;
            
                const intersects = BABYLON.BoundingBox.Intersects(obstacleBox, bonhommeBox);
                if (intersects) {
                    // Calcul de la direction de déplacement de l’obstacle (diff entre frames)
                    const movementVector = obj.position.subtract(obj._lastPosition || obj.position.clone());
            
                    // Appliquer une légère poussée dans cette direction
                    bonhomme.moveWithCollisions(movementVector.scale(0.6));
                }
            
                // Stocke la position pour comparer au prochain frame
                obj._lastPosition = obj.position.clone();
            });
            

            const cameraTarget = BABYLON.Vector3.Lerp(camera.target, bonhomme.position, 0.1);
            camera.alpha = BABYLON.Scalar.Lerp(camera.alpha, targetAlpha, 0.1);
            camera.beta = BABYLON.Scalar.Lerp(camera.beta, targetBeta, 0.1);
            camera.radius = BABYLON.Scalar.Lerp(camera.radius, 8, 0.1);
            camera.target = cameraTarget;

            const islandMesh = scene.getMeshByName("finalIsland");
            if (islandMesh && !checkpointReached) {
                const distance = BABYLON.Vector3.Distance(bonhomme.position, islandMesh.position);
            
                if (distance < 30) {
                    checkpointPosition = islandMesh.position.clone();
                    checkpointPosition.y += 1;
            
                    checkpointReached = true;
            
                    const sound = document.getElementById("checkpointSound");
                    sound.currentTime = 0;
                    sound.play();
            
                    const msg = document.getElementById("checkpointMessage");
                    msg.style.display = "block";
            
                    setTimeout(() => {
                        msg.style.opacity = "0";
                        setTimeout(() => {
                            msg.style.display = "none";
                            msg.style.opacity = "1";
                        }, 500);
                    }, 3000);
                }
            }
            
        });

        BABYLON.SceneLoader.ImportMesh(null, "models/", "demon_dragon_full_texture.glb", scene, function (meshes) {
            const importedMesh = meshes[0];
        
            // Crée un pivot invisible au centre
            const pivot = new BABYLON.TransformNode("modelPivot", scene);
            pivot.position = new BABYLON.Vector3(0, 0, 0); // centre du monde
        
            // Positionne le modèle à une certaine distance du centre
            importedMesh.parent = pivot;
            importedMesh.position = new BABYLON.Vector3(40, 1, 0); // rayon de l'orbite
            importedMesh.scaling = new BABYLON.Vector3(10, 10, 10);
            importedMesh.checkCollisions = true;
        
            // Animation de rotation du pivot
            scene.onBeforeRenderObservable.add(() => {
                pivot.rotate(BABYLON.Axis.Y, 0.002, BABYLON.Space.WORLD); // tourne autour de Y
            });
        });
        
        addSkyPlanet(scene);
        const blur = new BABYLON.BlurPostProcess("SandBlur", new BABYLON.Vector2(1.0, 1.0), 2.0, 1, scene.activeCamera);
        const sandParticles = new BABYLON.ParticleSystem("sand", 3000, scene);

        sandParticles.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", scene);

        sandParticles.emitter = new BABYLON.Vector3(0, 10, 0); // au-dessus de la scène
        sandParticles.minEmitBox = new BABYLON.Vector3(-100, 0, -100); 
        sandParticles.maxEmitBox = new BABYLON.Vector3(100, 200, 100); //hauteur des particules

        sandParticles.color1 = new BABYLON.Color4(0.95, 0.9, 0.8, 0.15); 
        sandParticles.color2 = new BABYLON.Color4(0.95, 0.9, 0.8, 0.15); 
        sandParticles.colorDead = new BABYLON.Color4(0.95, 0.9, 0.8, 0);


        sandParticles.minSize = 0.3;
        sandParticles.maxSize = 1.2;

        sandParticles.minLifeTime = 1;
        sandParticles.maxLifeTime = 4;

        sandParticles.emitRate = 1000;

        sandParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;

        sandParticles.gravity = new BABYLON.Vector3(0, -0.2, 0);
        sandParticles.direction1 = new BABYLON.Vector3(-1, 1, -1);
        sandParticles.direction2 = new BABYLON.Vector3(1, 1, 1);

        sandParticles.minAngularSpeed = 0;
        sandParticles.maxAngularSpeed = Math.PI;

        sandParticles.minEmitPower = 0.2;
        sandParticles.maxEmitPower = 0.4;

        sandParticles.updateSpeed = 0.02;

        sandParticles.start();

        
        return scene;
    };

    const scene = createScene();

    scene.executeWhenReady(() => {
        // Forcer un temps minimum d'affichage du loader (ex. 2 secondes)
        setTimeout(() => {
            loader.classList.remove('visible');
        }, 2000); // 2000 ms = 2 secondes
    });

    engine.runRenderLoop(() => {
        scene.render();
    });

    window.addEventListener('resize', () => {
        engine.resize();
    });
}

function createObject(solidObjects, plat, i, scene) {
    const obstacleCount = Math.floor(Math.random() * 3);
    const minDistance = 4;
    const existingObstacles = [];

    for (let j = 0; j < obstacleCount; j++) {
        const isSphere = Math.random() < 0.5;

        // Création de l'obstacle (carré ou sphère)
        const obstacle = isSphere
            ? BABYLON.MeshBuilder.CreateSphere(`obstacleSphere${i}_${j}`, { diameter: 3 }, scene)
            : BABYLON.MeshBuilder.CreateBox(`obstacleBox${i}_${j}`, { size: 3 }, scene);

        // Position de départ (au-dessus du centre)
        obstacle.position = new BABYLON.Vector3(
            plat.position.x,
            plat.position.y + 3, // Plus haut
            plat.position.z
        );

        obstacle.checkCollisions = true;

        const mat = new BABYLON.StandardMaterial(`obstacleMat${i}_${j}`, scene);
        mat.diffuseColor = new BABYLON.Color3(Math.random(), Math.random(), Math.random());
        obstacle.material = mat;

        obstacle.physicsImpostor = new BABYLON.PhysicsImpostor(
            obstacle,
            isSphere ? BABYLON.PhysicsImpostor.SphereImpostor : BABYLON.PhysicsImpostor.BoxImpostor,
            { mass: 1, restitution: 0.1, friction: 0.5 },
            scene
        );

        solidObjects.push(obstacle);
        existingObstacles.push(obstacle);

        // Animation dynamique autour de la plateforme
        const speed = 0.5 + Math.random() * 0.5; // vitesse légèrement variable
        const startAngle = Math.random() * Math.PI * 2; // angle de départ aléatoire

        scene.onBeforeRenderObservable.add(() => {
            const time = performance.now() * 0.001 * speed;
            const perimeter = 16; // Périmètre du carré (4x4)

            let t = (time + startAngle) * perimeter / (2 * Math.PI);

            // Faire avancer sur les 4 côtés
            t = t % perimeter;
            if (t < 4) { // Haut (gauche -> droite)
                obstacle.position.x = plat.position.x - 2 + t;
                obstacle.position.z = plat.position.z - 2;
            } else if (t < 8) { // Droite (haut -> bas)
                obstacle.position.x = plat.position.x + 2;
                obstacle.position.z = plat.position.z - 2 + (t - 4);
            } else if (t < 12) { // Bas (droite -> gauche)
                obstacle.position.x = plat.position.x + 2 - (t - 8);
                obstacle.position.z = plat.position.z + 2;
            } else { // Gauche (bas -> haut)
                obstacle.position.x = plat.position.x - 2;
                obstacle.position.z = plat.position.z + 2 - (t - 12);
            }
            obstacle.refreshBoundingInfo();
        });
    }
}

// Fonction pour vérifier si un obstacle est trop près d'un autre
function isTooClose(newPos, existingObstacles, minDistance) {
    for (let obstacle of existingObstacles) {
        const distance = BABYLON.Vector3.Distance(newPos, obstacle.position);
        if (distance < minDistance) {
            return true;
        }
    }
    return false;
}

function addRectangles(lastPlatformPos, rectangleDirection, scene, rectangleList, solidObjects, engine) {
    // Paramètres communs
    const rectangleHeight = 1.2;
    const rectangleWidth = 10;
    const rectangleDepth = 5;
    const amplitude = 5;
    const speed = 0.002;
    for (let i = 1; i <= 4; i++) {
        const offsetDistance = 15 * i;
        const pos = lastPlatformPos.add(rectangleDirection.scale(offsetDistance));

        const rectangle = BABYLON.MeshBuilder.CreateBox(`rectangle${i}`, {
            width: rectangleWidth,
            height: rectangleHeight,
            depth: rectangleDepth
        }, scene);

        rectangle.position = new BABYLON.Vector3(lastPlatformPos.x, lastPlatformPos.y, pos.z);
        rectangle.checkCollisions = true;

        const mat = new BABYLON.StandardMaterial(`rectangleMat${i}`, scene);
        mat.diffuseColor = new BABYLON.Color3(1 - (i * 0.2), 0.5, 0.2 + (i * 0.1));
        rectangle.material = mat;

        const baseX = rectangle.position.x;
        let time = 0;


        scene.onBeforeRenderObservable.add(() => {
            time += engine.getDeltaTime();
            const directionFactor = (i % 2 === 0) ? -1 : 1;
            rectangle.position.x = baseX + directionFactor * Math.sin(time * speed) * amplitude;
            rectangle.refreshBoundingInfo();
        });
        rectangleList.push(rectangle);
        solidObjects.push(rectangle);
    }
}

function addSceneOptions(scene){
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 1.4; // au lieu de 1


    scene.gravity = new BABYLON.Vector3(0, -0.2, 0);
    scene.collisionsEnabled = true;

    scene.clearColor = new BABYLON.Color4(0.6, 0.4, 0.9, 1);
    const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
    const skyboxMaterial = new BABYLON.StandardMaterial("skyBoxMaterial", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://playground.babylonjs.com/textures/skybox", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;

    const ground = BABYLON.MeshBuilder.CreateDisc("ground", {
        radius: 30,
        tessellation: 64,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, scene);
    ground.rotation.x = Math.PI / 2;
    ground.position.y = 0;
    ground.checkCollisions = true;

    const groundMaterial = new BABYLON.StandardMaterial("groundMat", scene);
    const texture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/grass.png", scene);
    texture.uScale = 10;
    texture.vScale = 10;
    groundMaterial.diffuseTexture = texture;
    ground.material = groundMaterial;

    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.0015;
    scene.fogColor = new BABYLON.Color3(0.95, 0.93, 0.88); // beige très clair


    const colorGradingTexture = new BABYLON.ColorGradingTexture("https://playground.babylonjs.com/textures/LateSunset.3dl", scene);
    scene.imageProcessingConfiguration.colorGradingEnabled = true;
    scene.imageProcessingConfiguration.colorGradingTexture = colorGradingTexture;


}

function addDecorations(scene, solidObjects) {
    const islandRadius = 30;
    const decorationCount = 15;
    const ringRadius = islandRadius * 0.85; // Un peu à l'intérieur du bord

    for (let i = 0; i < decorationCount; i++) {
        const angle = (i / decorationCount) * Math.PI * 2; // Répartition régulière en cercle
        const posX = Math.cos(angle) * ringRadius;
        const posZ = Math.sin(angle) * ringRadius;

        BABYLON.SceneLoader.ImportMesh(
            "",
            "models/",
            "green_tree.glb",
            scene,
            function (meshes) {
                const rootMesh = meshes[0].clone("tree_" + i); // Clone pour éviter les conflits
                rootMesh.position = new BABYLON.Vector3(posX, 3.5, posZ);
                rootMesh.scaling = new BABYLON.Vector3(5, 5, 5);
                rootMesh.rotation.y = Math.random() * Math.PI * 2;
                solidObjects.push(rootMesh);
            }
        );
    }
}
function addSkyPlanet(scene) {
    BABYLON.SceneLoader.ImportMesh(
        "",
        "models/",
        "planet_earth.glb", // Remplace par le nom réel si différent
        scene,
        function (meshes) {
            const planet = meshes[0];
            planet.position = new BABYLON.Vector3(0, 100, -200); // Loin et en hauteur
            planet.scaling = new BABYLON.Vector3(50, 50, 50);    // Grande taille pour bien voir
        }
    );
}
