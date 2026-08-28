package com.teamflow;

import org.springframework.boot.SpringApplication;

public class TestTeamflowApplication {

	public static void main(String[] args) {
		SpringApplication.from(TeamflowApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
