window.addEventListener('DOMContentLoaded', function () {
    const canvas = document.getElementById('renderCanvas');
    const engine = new BABYLON.Engine(canvas, true);

    let bonhomme; // Personnage contrôlé

    const createScene = function () {
        const scene = new BABYLON.Scene(engine);
        scene.gravity = new BABYLON.Vector3(0, -0.2, 0);
        scene.collisionsEnabled = true;

        scene.clearColor = new BABYLON.Color4(0.6, 0.4, 0.9, 1);

        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

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
        const platformPositions = [
            new BABYLON.Vector3(10, 3, 0),
            new BABYLON.Vector3(20, 6, -5),
            new BABYLON.Vector3(30, 9, 5),
            new BABYLON.Vector3(40, 12, 0),
            new BABYLON.Vector3(50, 15, -5)
        ];

        platformPositions.forEach((pos, i) => {
            const plat = BABYLON.MeshBuilder.CreateDisc(`platform${i}`, {
                radius: 6,
                tessellation: 64,
                sideOrientation: BABYLON.Mesh.DOUBLESIDE
            }, scene);
            plat.rotation.x = Math.PI / 2;
            plat.position = pos;
            plat.checkCollisions = true;

            const mat = new BABYLON.StandardMaterial(`platMat${i}`, scene);
            mat.diffuseColor = new BABYLON.Color3(0.6, 0.8, 1);
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
        bonhomme.position.y = 1;
        bonhomme.checkCollisions = true;
        bonhomme.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
        bonhomme.ellipsoidOffset = new BABYLON.Vector3(0, 1, 0);

        const camera = new BABYLON.ArcRotateCamera("arcCam", Math.PI / 2, Math.PI / 2.5, 20, new BABYLON.Vector3(0, 1, 0), scene);
        camera.attachControl(canvas, true);

        let mouseSensitivity = 0.002;
        let verticalSensitivity = 0.002;
        let alpha = camera.alpha;
        let beta = camera.beta;

        canvas.addEventListener("mousemove", (e) => {
            if (!document.pointerLockElement) return;
            alpha -= e.movementX * mouseSensitivity;
            beta -= e.movementY * verticalSensitivity;
            beta = BABYLON.Scalar.Clamp(beta, 0.2, Math.PI / 2.2);
            camera.alpha = alpha;
            camera.beta = beta;
        });

        canvas.addEventListener("click", () => {
            canvas.requestPointerLock();
        });

        const inputMap = {};
        scene.actionManager = new BABYLON.ActionManager(scene);
        scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, evt => {
            inputMap[evt.sourceEvent.key.toLowerCase()] = true;
        }));
        scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, evt => {
            inputMap[evt.sourceEvent.key.toLowerCase()] = false;
        }));

        let velocityY = 0;
        let isJumping = false;

        BABYLON.SceneLoader.ImportMesh("", "models/", "old_rusty_car.glb", scene, function (meshes) {
            const voiture = meshes[0]; // Le premier mesh du modèle
            voiture.position = new BABYLON.Vector3(5, 0, 0); // Positionne-le où tu veux
            voiture.scaling = new BABYLON.Vector3(0.03, 0.03, 0.03);
            voiture.checkCollisions = true;
        });

        platforms.push(voiture);

        scene.onBeforeRenderObservable.add(() => {
            if (!bonhomme) return;

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

            camera.target = bonhomme.position;
        });

        
        return scene;
    };

    const scene = createScene();

    engine.runRenderLoop(() => {
        scene.render();
    });

    window.addEventListener('resize', () => {
        engine.resize();
    });
});
