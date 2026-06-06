@Library('jenkins-share-lib@main') _

node('linux') {
    properties([
        parameters([
            string(
                name: 'IMAGE_REPOSITORY',
                defaultValue: 'ghcr.io/Flavoriy/tikto',
                description: 'GHCR image repository, for example ghcr.io/my-org/tikto'
            ),
            string(
                name: 'DOCKERFILE',
                defaultValue: 'Dockerfile',
                description: 'Dockerfile path'
            ),
            string(
                name: 'DOCKER_CONTEXT',
                defaultValue: '.',
                description: 'Docker build context'
            )
        ])
    ])

    checkout scm

    buildApp(
        stageName: 'Clean Install',
        language: 'shell',
        commands: ['npm ci']
    )

    buildApp(
        stageName: 'Build',
        language: 'shell',
        commands: ['npm run build']
    )

    def imageRef = dockerBuild(
        imageRepository: params.IMAGE_REPOSITORY,
        dockerfile: params.DOCKERFILE,
        context: params.DOCKER_CONTEXT
    )

    dockerPush(
        imageRef: imageRef,
        registry: 'ghcr.io',
        credentialsId: 'ghcr-token'
    )
}
