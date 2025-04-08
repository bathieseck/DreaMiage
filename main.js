window.addEventListener('DOMContentLoaded', function () {
    const canvas = document.getElementById('renderCanvas');
    const engine = new BABYLON.Engine(canvas, true);

    let bonhomme;

    const createScene = function () {
        const scene = new BABYLON.Scene(engine);
        scene.gravity = new BABYLON.Vector3(0, -0.2, 0);
        scene.collisionsEnabled = true;

        // Ciel féérique
        scene.clearColor = new BABYLON.Color4(0.6, 0.4, 0.9, 1);

        // Lumière
        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

        // Sol circulaire flottant
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

        // Import du personnage GLB
        BABYLON.SceneLoader.ImportMesh(
            "", "models/", "casual_lowpoly_male_rig_t-pose.glb", scene,
            function (meshes) {
                bonhomme = meshes[0];
                bonhomme.position = new BABYLON.Vector3(0, 1, 0);
                bonhomme.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);
                bonhomme.checkCollisions = true;
                bonhomme.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
                bonhomme.ellipsoidOffset = new BABYLON.Vector3(0, 1, 0);
            }
        );

        // Caméra fluide
        const camera = new BABYLON.ArcRotateCamera("arcCam", Math.PI / 2, Math.PI / 2.5, 20, new BABYLON.Vector3(0, 1, 0), scene);

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

        // Contrôles clavier
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

        scene.onBeforeRenderObservable.add(() => {
            if (!bonhomme) return;

            let baseSpeed = 0.12;
            let sprintSpeed = 0.36;
            let speed = inputMap["shift"] ? sprintSpeed : baseSpeed;

            // Rotation automatique vers la direction de la caméra
            const cameraDirection = camera.getForwardRay().direction.clone();
            cameraDirection.y = 0;
            cameraDirection.normalize();
            bonhomme.rotation.y = Math.atan2(cameraDirection.x, cameraDirection.z);

            // Déplacement
            let input = new BABYLON.Vector3.Zero();
            if (inputMap["s"] || inputMap["arrowdown"]) input.z += 1;
            if (inputMap["z"] || inputMap["arrowup"]) input.z -= 1;
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
            }

            // Plateforme circulaire
            const distanceFromCenter = Math.sqrt(
                Math.pow(bonhomme.position.x, 2) + Math.pow(bonhomme.position.z, 2)
            );
            const platformRadius = 30;
            const isOnPlatform = distanceFromCenter <= platformRadius;

            // Saut
            if (isOnPlatform && !isJumping && inputMap[" "]) {
                velocityY = 0.3;
                isJumping = true;
            }

            // Gravité
            velocityY -= 0.005;
            bonhomme.position.y += velocityY;

            if (isOnPlatform && bonhomme.position.y <= 1) {
                bonhomme.position.y = 1;
                velocityY = 0;
                isJumping = false;
            }

            // Respawn
            if (bonhomme.position.y < -100) {
                const currentAlpha = camera.alpha;
                const currentBeta = camera.beta;

                bonhomme.position = new BABYLON.Vector3(0, 5, 0);
                velocityY = 0;
                isJumping = false;

                camera.alpha = currentAlpha;
                camera.beta = currentBeta;
            }

            // Caméra suit le perso
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
