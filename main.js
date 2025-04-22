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
        const scene = new BABYLON.Scene(engine);
        scene.gravity = new BABYLON.Vector3(0, -0.2, 0);
        scene.collisionsEnabled = true;

        scene.clearColor = new BABYLON.Color4(0.6, 0.4, 0.9, 1);

        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

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

        const platforms = [];
        const platformPositions = [];

        // Génération des 50 plateformes avec un effet tordu horizontalement
        for (let i = 0; i < 50; i++) {
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

            const mat = new BABYLON.StandardMaterial(`platMat${i}`, scene);
            mat.diffuseColor = new BABYLON.Color3(0.6, 0.8, 1);  // Couleur bleue
            plat.material = mat;

            platforms.push(plat);
        });

        const body = BABYLON.MeshBuilder.CreateCylinder("body", { diameter: 1, height: 2 }, scene);
        body.position.y = 1;
        const head = BABYLON.MeshBuilder.CreateSphere("head", { diameter: 1 }, scene);
        head.position.y = 2.5;
        const leftArm = BABYLON.MeshBuilder.CreateCylinder("leftArm", { diameter: 0.3, height: 1.5 }, scene);
        leftArm.rotation.z = Math.PI / 2;
        leftArm.position = new BABYLON.Vector3(-0.9, 1.5, 0);
        const rightArm = leftArm.clone("rightArm");
        rightArm.position.x = 0.9;
        const leftLeg = BABYLON.MeshBuilder.CreateCylinder("leftLeg", { diameter: 0.4, height: 2 }, scene);
        leftLeg.position = new BABYLON.Vector3(-0.4, 0, 0);
        const rightLeg = leftLeg.clone("rightLeg");
        rightLeg.position.x = 0.4;

        bonhomme = BABYLON.Mesh.MergeMeshes([body, head, leftArm, rightArm, leftLeg, rightLeg], true);
        bonhomme.checkCollisions = true;
        bonhomme.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
        bonhomme.ellipsoidOffset = new BABYLON.Vector3(0, 1, 0);

        const savedPos = localStorage.getItem("bonhomme_position");
        if (savedPos) {
            const pos = JSON.parse(savedPos);
            bonhomme.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
        } else {
            bonhomme.position = new BABYLON.Vector3(0, 5, 0);
        }

        const camera = new BABYLON.ArcRotateCamera("arcCam", Math.PI / 2, Math.PI / 2.5, 20, new BABYLON.Vector3(0, 1, 0), scene);
        camera.attachControl(canvas, true);

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

        BABYLON.SceneLoader.ImportMesh("", "models/", "old_rusty_car.glb", scene, function (meshes) {
            const voiture = meshes[0];
            voiture.position = new BABYLON.Vector3(5, 0, 0);
            voiture.scaling = new BABYLON.Vector3(0.03, 0.03, 0.03);
            voiture.checkCollisions = true;
        });

        scene.onBeforeRenderObservable.add(() => {
            if (!bonhomme) return;

            // Sauvegarde auto
            localStorage.setItem("bonhomme_position", JSON.stringify({
                x: bonhomme.position.x,
                y: bonhomme.position.y,
                z: bonhomme.position.z
            }));

            let baseSpeed = 0.12;
            let sprintSpeed = 0.36;
            let speed = inputMap["shift"] ? sprintSpeed : baseSpeed;

            let input = new BABYLON.Vector3.Zero();
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

            // Gestion des collisions au sol et sur plateformes
            let onSomething = false;
            const platformRadius = 30;

            if (bonhomme.position.y <= 1 && Math.sqrt(bonhomme.position.x ** 2 + bonhomme.position.z ** 2) <= platformRadius) {
                bonhomme.position.y = 1;
                velocityY = 0;
                isJumping = false;
                onSomething = true;
            }

            platforms.forEach(plat => {
                const dx = bonhomme.position.x - plat.position.x;
                const dz = bonhomme.position.z - plat.position.z;
                const horizontalDist = Math.sqrt(dx * dx + dz * dz);
                const isAbove = bonhomme.position.y > plat.position.y;
                const isFalling = velocityY <= 0;

                if (horizontalDist <= 5.5 && isAbove && isFalling) {
                    const diffY = bonhomme.position.y - plat.position.y;
                    if (diffY <= 1.1) {
                        bonhomme.position.y = plat.position.y + 1;
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
                bonhomme.position = new BABYLON.Vector3(0, 5, 0);
                velocityY = 0;
                isJumping = false;
                camera.alpha = currentAlpha;
                camera.beta = currentBeta;
            }

            const cameraTarget = BABYLON.Vector3.Lerp(camera.target, bonhomme.position, 0.1);
            camera.alpha = BABYLON.Scalar.Lerp(camera.alpha, targetAlpha, 0.1);
            camera.beta = BABYLON.Scalar.Lerp(camera.beta, targetBeta, 0.1);
            camera.radius = BABYLON.Scalar.Lerp(camera.radius, 8, 0.1);

            camera.target = cameraTarget;
        });

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
