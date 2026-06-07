@Library('jenkins-share-lib@main') _

node('agent') {
    checkout scm

    String imageRepository = (params.IMAGE_REPOSITORY ?: env.IMAGE_REPOSITORY ?: 'ghcr.io/flavoriy/tikto').trim()
    String dockerfile = (params.DOCKERFILE ?: env.DOCKERFILE ?: 'Dockerfile').trim()
    String dockerContext = (params.DOCKER_CONTEXT ?: env.DOCKER_CONTEXT ?: '.').trim()

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
        imageRepository: imageRepository,
        dockerfile: dockerfile,
        context: dockerContext
    )

    dockerPush(
        imageRef: imageRef,
        registry: 'ghcr.io',
        credentialsId: 'ghcr-token'
    )
}
